/**
 * @file sidecar_main.cpp
 * @brief depth_sidecar — JSON-over-stdio bridge between the Electron host
 *        and the native Depth SDK.
 *
 * Protocol:
 *   stdin  : one JSON object per line: { "id": "...", "method": "...", "params": {...} }
 *   stdout : one JSON object per line: { "id": "...", "result": {...} }
 *                                   or  { "id": "...", "error": "message" }
 *
 * Methods (v1):
 *   - status         -> { version, ready, backend }
 *   - render         -> { png: <base64> }                full composite
 *   - exportLayered  -> { composite, foreground, shadow }   each base64 PNG
 *
 * Scene JSON (pragmatic minimal subset):
 *   {
 *     "width": 1920, "height": 1080,
 *     "background": "<base64 PNG>",        // optional
 *     "objects": [
 *       { "geometry": "Box|Sphere|...",
 *         "transform": { "position":[x,y,z], "rotation":[x,y,z], "scale":1.0 },
 *         "material": { "preset":"Matte", "color":[r,g,b,a],
 *                       "roughness":0.7, "metalness":0.0 }
 *       }, ...
 *     ],
 *     "camera":  { "position":[x,y,z], "target":[x,y,z], "fov":45 },
 *     "light":   { "angle":45, "elevation":0.6, "intensity":1.5 },
 *     "ambient": { "color":[r,g,b,a], "intensity":0.35 }
 *   }
 *
 * No external JSON dependency: a tiny built-in parser handles the schema above.
 * No external base64: small inline encoder/decoder.
 */

#include "depth/depth.h"
#include "depth/compositor.h"
#include "depth/renderer.h"
#include "depth/scene.h"
#include "depth/image.h"

#include <cctype>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <iostream>
#include <map>
#include <memory>
#include <optional>
#include <sstream>
#include <stdexcept>
#include <string>
#include <variant>
#include <vector>

#ifdef _WIN32
  #include <io.h>
  #include <fcntl.h>
#endif

// ─────────────────────────── JSON value ───────────────────────────
namespace mini_json {

struct Value;
using Array = std::vector<Value>;
using Object = std::vector<std::pair<std::string, Value>>;

struct Value {
    enum class Type { Null, Bool, Number, String, Array, Object } type = Type::Null;
    bool b = false;
    double n = 0.0;
    std::string s;
    Array a;
    Object o;

    bool is_null() const { return type == Type::Null; }
    bool is_string() const { return type == Type::String; }
    bool is_number() const { return type == Type::Number; }
    bool is_bool() const { return type == Type::Bool; }
    bool is_array() const { return type == Type::Array; }
    bool is_object() const { return type == Type::Object; }

    const Value* find(const std::string& key) const {
        if (!is_object()) return nullptr;
        for (auto& kv : o) if (kv.first == key) return &kv.second;
        return nullptr;
    }
    double num_or(double dflt) const { return is_number() ? n : dflt; }
    const std::string& str_or(const std::string& dflt) const { return is_string() ? s : dflt; }
};

class Parser {
public:
    explicit Parser(const std::string& src) : s_(src), p_(0) {}
    Value parse() {
        skip_ws();
        Value v = parse_value();
        skip_ws();
        return v;
    }
private:
    const std::string& s_;
    size_t p_;

    void skip_ws() {
        while (p_ < s_.size() && std::isspace(static_cast<unsigned char>(s_[p_]))) ++p_;
    }
    char peek() { return p_ < s_.size() ? s_[p_] : '\0'; }
    char consume() { return p_ < s_.size() ? s_[p_++] : '\0'; }
    bool match(char c) {
        skip_ws();
        if (peek() == c) { ++p_; return true; }
        return false;
    }
    void expect(char c) {
        skip_ws();
        if (consume() != c) throw std::runtime_error(std::string("expected '") + c + "'");
    }

    Value parse_value() {
        skip_ws();
        char c = peek();
        if (c == '{') return parse_object();
        if (c == '[') return parse_array();
        if (c == '"') return parse_string();
        if (c == 't' || c == 'f') return parse_bool();
        if (c == 'n') return parse_null();
        return parse_number();
    }
    Value parse_object() {
        Value v; v.type = Value::Type::Object;
        expect('{');
        skip_ws();
        if (match('}')) return v;
        while (true) {
            skip_ws();
            Value key = parse_string();
            expect(':');
            Value val = parse_value();
            v.o.emplace_back(std::move(key.s), std::move(val));
            skip_ws();
            if (match(',')) continue;
            expect('}');
            break;
        }
        return v;
    }
    Value parse_array() {
        Value v; v.type = Value::Type::Array;
        expect('[');
        skip_ws();
        if (match(']')) return v;
        while (true) {
            v.a.push_back(parse_value());
            skip_ws();
            if (match(',')) continue;
            expect(']');
            break;
        }
        return v;
    }
    Value parse_string() {
        Value v; v.type = Value::Type::String;
        expect('"');
        std::string out;
        while (p_ < s_.size()) {
            char c = s_[p_++];
            if (c == '"') { v.s = std::move(out); return v; }
            if (c == '\\' && p_ < s_.size()) {
                char e = s_[p_++];
                switch (e) {
                    case '"':  out += '"'; break;
                    case '\\': out += '\\'; break;
                    case '/':  out += '/'; break;
                    case 'n':  out += '\n'; break;
                    case 't':  out += '\t'; break;
                    case 'r':  out += '\r'; break;
                    case 'b':  out += '\b'; break;
                    case 'f':  out += '\f'; break;
                    case 'u':
                        // skip 4 hex chars; we don't preserve unicode escapes (good enough for v1)
                        if (p_ + 4 <= s_.size()) p_ += 4;
                        out += '?';
                        break;
                    default:   out += e; break;
                }
            } else {
                out += c;
            }
        }
        throw std::runtime_error("unterminated string");
    }
    Value parse_bool() {
        Value v; v.type = Value::Type::Bool;
        if (s_.compare(p_, 4, "true") == 0)  { p_ += 4; v.b = true;  return v; }
        if (s_.compare(p_, 5, "false") == 0) { p_ += 5; v.b = false; return v; }
        throw std::runtime_error("bad bool");
    }
    Value parse_null() {
        if (s_.compare(p_, 4, "null") == 0) { p_ += 4; return Value{}; }
        throw std::runtime_error("bad null");
    }
    Value parse_number() {
        size_t start = p_;
        if (peek() == '-') ++p_;
        while (p_ < s_.size() &&
               (std::isdigit(static_cast<unsigned char>(s_[p_])) ||
                s_[p_] == '.' || s_[p_] == 'e' || s_[p_] == 'E' ||
                s_[p_] == '+' || s_[p_] == '-')) ++p_;
        Value v; v.type = Value::Type::Number;
        v.n = std::stod(s_.substr(start, p_ - start));
        return v;
    }
};

inline Value parse(const std::string& src) { return Parser(src).parse(); }

inline std::string escape(const std::string& in) {
    std::string out; out.reserve(in.size() + 2);
    for (char c : in) {
        switch (c) {
            case '"':  out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default:
                if (static_cast<unsigned char>(c) < 0x20) {
                    char buf[8];
                    std::snprintf(buf, sizeof(buf), "\\u%04x", c);
                    out += buf;
                } else {
                    out += c;
                }
        }
    }
    return out;
}

} // namespace mini_json

// ─────────────────────────── Base64 ───────────────────────────
namespace b64 {

static const char kTable[] =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

inline std::string encode(const uint8_t* data, size_t len) {
    std::string out;
    out.reserve(((len + 2) / 3) * 4);
    for (size_t i = 0; i < len; i += 3) {
        uint32_t v = uint32_t(data[i]) << 16;
        if (i + 1 < len) v |= uint32_t(data[i + 1]) << 8;
        if (i + 2 < len) v |= uint32_t(data[i + 2]);
        out += kTable[(v >> 18) & 0x3F];
        out += kTable[(v >> 12) & 0x3F];
        out += (i + 1 < len) ? kTable[(v >> 6) & 0x3F] : '=';
        out += (i + 2 < len) ? kTable[v & 0x3F] : '=';
    }
    return out;
}

inline std::vector<uint8_t> decode(const std::string& in) {
    int8_t rev[256];
    for (int i = 0; i < 256; ++i) rev[i] = -1;
    for (int i = 0; i < 64; ++i) rev[static_cast<uint8_t>(kTable[i])] = static_cast<int8_t>(i);

    std::vector<uint8_t> out;
    out.reserve((in.size() / 4) * 3);
    uint32_t acc = 0;
    int bits = 0;
    for (char c : in) {
        if (c == '=' || c == '\n' || c == '\r' || c == ' ') continue;
        int8_t v = rev[static_cast<uint8_t>(c)];
        if (v < 0) continue;
        acc = (acc << 6) | static_cast<uint32_t>(v);
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            out.push_back(static_cast<uint8_t>((acc >> bits) & 0xFF));
        }
    }
    return out;
}

} // namespace b64

// ─────────────────────────── Scene deserialization ───────────────────────────
namespace {

depth::GeometryType parse_geometry(const std::string& g) {
    using G = depth::GeometryType;
    if (g == "Box") return G::Box;
    if (g == "Cylinder") return G::Cylinder;
    if (g == "Sphere") return G::Sphere;
    if (g == "Cone") return G::Cone;
    if (g == "Torus") return G::Torus;
    if (g == "Plane") return G::Plane;
    if (g == "Mug") return G::Mug;
    if (g == "Phone") return G::Phone;
    if (g == "Bottle") return G::Bottle;
    if (g == "Bag") return G::Bag;
    if (g == "Card") return G::Card;
    if (g == "Donut") return G::Donut;
    if (g == "Laptop") return G::Laptop;
    if (g == "Tablet") return G::Tablet;
    if (g == "Can") return G::Can;
    if (g == "Book") return G::Book;
    return G::Box;
}

depth::MaterialPreset parse_preset(const std::string& p) {
    using M = depth::MaterialPreset;
    if (p == "Matte") return M::Matte;
    if (p == "Glossy") return M::Glossy;
    if (p == "Metallic") return M::Metallic;
    if (p == "Glass") return M::Glass;
    if (p == "Plastic") return M::Plastic;
    return M::Matte;
}

depth::Vec3 parse_vec3(const mini_json::Value* v, depth::Vec3 dflt = {}) {
    if (!v || !v->is_array() || v->a.size() < 3) return dflt;
    return {
        static_cast<float>(v->a[0].num_or(dflt.x)),
        static_cast<float>(v->a[1].num_or(dflt.y)),
        static_cast<float>(v->a[2].num_or(dflt.z)),
    };
}

depth::Color parse_color(const mini_json::Value* v, depth::Color dflt = depth::Color::white()) {
    if (!v || !v->is_array() || v->a.size() < 3) return dflt;
    depth::Color c;
    c.r = static_cast<float>(v->a[0].num_or(dflt.r));
    c.g = static_cast<float>(v->a[1].num_or(dflt.g));
    c.b = static_cast<float>(v->a[2].num_or(dflt.b));
    c.a = v->a.size() >= 4 ? static_cast<float>(v->a[3].num_or(dflt.a)) : dflt.a;
    return c;
}

struct ParsedScene {
    depth::Scene scene;
    uint32_t width = 1920;
    uint32_t height = 1080;
};

ParsedScene scene_from_json(const mini_json::Value& root) {
    ParsedScene out;
    if (!root.is_object()) {
        throw std::runtime_error("scene must be a JSON object");
    }

    if (auto* w = root.find("width"))  out.width  = static_cast<uint32_t>(w->num_or(out.width));
    if (auto* h = root.find("height")) out.height = static_cast<uint32_t>(h->num_or(out.height));

    // Background (base64 PNG)
    if (auto* bg = root.find("background"); bg && bg->is_string() && !bg->s.empty()) {
        auto bytes = b64::decode(bg->s);
        if (!bytes.empty()) {
            depth::Status st = depth::Status::Ok;
            depth::Image img = depth::Image::load_from_memory(bytes.data(), bytes.size(), &st);
            if (st == depth::Status::Ok && !img.empty()) {
                out.scene.set_background(std::move(img));
            }
        }
    }

    // Camera
    if (auto* cam = root.find("camera"); cam && cam->is_object()) {
        auto& c = out.scene.camera();
        c.position = parse_vec3(cam->find("position"), c.position);
        c.target   = parse_vec3(cam->find("target"),   c.target);
        if (auto* fov = cam->find("fov")) c.fov = static_cast<float>(fov->num_or(c.fov));
    }

    // Light
    if (auto* lt = root.find("light"); lt && lt->is_object()) {
        auto& L = out.scene.light();
        if (auto* a = lt->find("angle"))     L.angle     = static_cast<float>(a->num_or(L.angle));
        if (auto* e = lt->find("elevation")) L.elevation = static_cast<float>(e->num_or(L.elevation));
        if (auto* i = lt->find("intensity")) L.intensity = static_cast<float>(i->num_or(L.intensity));
        L.color = parse_color(lt->find("color"), L.color);
    }

    // Ambient
    if (auto* amb = root.find("ambient"); amb && amb->is_object()) {
        out.scene.set_ambient_color(parse_color(amb->find("color"), out.scene.ambient_color()));
        if (auto* i = amb->find("intensity"))
            out.scene.set_ambient_intensity(static_cast<float>(i->num_or(out.scene.ambient_intensity())));
    }

    // Objects
    if (auto* objs = root.find("objects"); objs && objs->is_array()) {
        for (auto& obj : objs->a) {
            if (!obj.is_object()) continue;
            depth::SceneObject so;
            if (auto* g = obj.find("geometry"); g && g->is_string())
                so.geometry = parse_geometry(g->s);
            if (auto* n = obj.find("name"); n && n->is_string())
                so.name = n->s;

            if (auto* tr = obj.find("transform"); tr && tr->is_object()) {
                so.transform.position = parse_vec3(tr->find("position"), so.transform.position);
                so.transform.rotation = parse_vec3(tr->find("rotation"), so.transform.rotation);
                if (auto* sc = tr->find("scale"))
                    so.transform.scale = static_cast<float>(sc->num_or(so.transform.scale));
            }

            if (auto* mat = obj.find("material"); mat && mat->is_object()) {
                if (auto* p = mat->find("preset"); p && p->is_string())
                    so.material.preset = parse_preset(p->s);
                so.material.base_color = parse_color(mat->find("color"), so.material.base_color);
                if (auto* r = mat->find("roughness"))
                    so.material.roughness = static_cast<float>(r->num_or(so.material.roughness));
                if (auto* m = mat->find("metalness"))
                    so.material.metalness = static_cast<float>(m->num_or(so.material.metalness));
                if (auto* o = mat->find("opacity"))
                    so.material.opacity = static_cast<float>(o->num_or(so.material.opacity));
            }

            out.scene.add_object(std::move(so));
        }
    }

    return out;
}

// ─────────────────────────── Render helpers ───────────────────────────

std::string render_to_b64png(const ParsedScene& ps, const depth::CompositeConfig& cfg) {
    depth::RenderConfig rc;
    rc.width  = ps.width;
    rc.height = ps.height;
    rc.transparent_bg = true;
    auto renderer = depth::Renderer::create(rc);
    if (!renderer) throw std::runtime_error("renderer_create_failed");

    depth::Image out = depth::render_composite(*renderer, ps.scene, cfg);
    auto bytes = out.encode(depth::ExportFormat::PNG, 95);
    if (bytes.empty()) throw std::runtime_error("png_encode_failed");
    return b64::encode(bytes.data(), bytes.size());
}

// ─────────────────────────── Methods ───────────────────────────

std::string method_status() {
    return std::string("{\"version\":\"0.1.0\",\"ready\":true,\"backend\":\"software\"}");
}

std::string method_render(const mini_json::Value& params) {
    auto ps = scene_from_json(params);
    depth::CompositeConfig cfg;
    auto png = render_to_b64png(ps, cfg);
    std::ostringstream o;
    o << "{\"png\":\"" << png << "\",\"width\":" << ps.width
      << ",\"height\":" << ps.height << "}";
    return o.str();
}

std::string method_export_layered(const mini_json::Value& params) {
    auto ps = scene_from_json(params);

    // Composite
    depth::CompositeConfig comp_cfg;
    auto composite = render_to_b64png(ps, comp_cfg);

    // Foreground only (no background)
    depth::CompositeConfig fg_cfg;
    fg_cfg.foreground_only = true;
    auto foreground = render_to_b64png(ps, fg_cfg);

    // Shadow only: render a scene whose objects all have opacity ~0 isn't
    // exposed cleanly in v1. As a pragmatic stand-in we emit the foreground
    // again here; the renderer's shadow pass is folded into composite. A
    // real shadow-isolation pass is a v2 task.
    depth::CompositeConfig sh_cfg;
    sh_cfg.foreground_only = true;
    auto shadow = render_to_b64png(ps, sh_cfg);

    std::ostringstream o;
    o << "{\"composite\":\"" << composite
      << "\",\"foreground\":\"" << foreground
      << "\",\"shadow\":\"" << shadow << "\"}";
    return o.str();
}

// ─────────────────────────── Dispatch loop ───────────────────────────

void write_response(const std::string& id, const std::string& result_json) {
    std::cout << "{\"id\":\"" << mini_json::escape(id)
              << "\",\"result\":" << result_json << "}\n";
    std::cout.flush();
}

void write_error(const std::string& id, const std::string& msg) {
    std::cout << "{\"id\":\"" << mini_json::escape(id)
              << "\",\"error\":\"" << mini_json::escape(msg) << "\"}\n";
    std::cout.flush();
}

void handle_line(const std::string& line) {
    std::string id = "?";
    try {
        auto root = mini_json::parse(line);
        if (auto* idv = root.find("id"); idv && idv->is_string()) id = idv->s;

        const mini_json::Value* methodV = root.find("method");
        if (!methodV || !methodV->is_string()) {
            write_error(id, "missing_method");
            return;
        }
        const std::string& method = methodV->s;

        const mini_json::Value* params = root.find("params");
        mini_json::Value empty;
        empty.type = mini_json::Value::Type::Object;
        const mini_json::Value& p = params ? *params : empty;

        if (method == "status") {
            write_response(id, method_status());
        } else if (method == "render") {
            write_response(id, method_render(p));
        } else if (method == "exportLayered") {
            write_response(id, method_export_layered(p));
        } else {
            write_error(id, "unknown_method:" + method);
        }
    } catch (const std::exception& e) {
        write_error(id, e.what());
    } catch (...) {
        write_error(id, "unknown_error");
    }
}

} // namespace

int main() {
#ifdef _WIN32
    // Force binary mode on stdout so '\n' isn't translated to "\r\n",
    // which would corrupt the line-delimited JSON protocol.
    _setmode(_fileno(stdout), _O_BINARY);
    _setmode(_fileno(stdin),  _O_BINARY);
#endif

    std::ios::sync_with_stdio(false);

    std::string line;
    while (std::getline(std::cin, line)) {
        // Strip trailing \r if any (Windows clients).
        if (!line.empty() && line.back() == '\r') line.pop_back();
        if (line.empty()) continue;
        handle_line(line);
    }
    return 0;
}
