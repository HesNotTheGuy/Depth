/**
 * @file sceneSerializer.ts
 * @brief Serializes the Zustand scene state into a JSON payload that the
 *        native C++ sidecar (`depth_sidecar`) can deserialize and render.
 *
 * This is the contract bridge between the browser-side scene state and the
 * native renderer. Keep it pure — no IO, no React hooks. The companion
 * parser lives in `sdk/src/sidecar/sidecar_main.cpp::scene_from_json`.
 *
 * Wire format conventions:
 *   - Geometry & material preset names are sent lowercase (matching the
 *     web app's discriminated unions). The sidecar accepts both casings.
 *   - Colors are sent as [r,g,b] floats in [0,1].
 *   - Images (background, textures, face textures) are base64 PNG bytes —
 *     with the `data:image/...;base64,` prefix stripped.
 */
import type {
  BlendMode,
  FaceTextureConfig,
  SceneLight,
  SceneObjectInstance,
  SurfacePlane,
  Vec3,
} from '../store/useSceneStore';
import type { EstimatedLighting } from './lightingEstimator';

/** Strip the `data:...;base64,` prefix from a data URL, or return the input
 *  unchanged if it's already raw base64 / null. */
function stripDataUrl(s: string | null | undefined): string | null {
  if (!s) return null;
  const comma = s.indexOf(',');
  if (s.startsWith('data:') && comma >= 0) return s.slice(comma + 1);
  return s;
}

/** Convert a `#rrggbb` (or `#rgb`) hex color to [r,g,b] floats in [0,1]. */
function hexToRgb(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6 || !/^[0-9a-fA-F]+$/.test(h)) return [1, 1, 1];
  const n = parseInt(h, 16);
  return [
    ((n >> 16) & 0xff) / 255,
    ((n >> 8) & 0xff) / 255,
    (n & 0xff) / 255,
  ];
}

function vec3ToArr(v: Vec3): [number, number, number] {
  return [v.x, v.y, v.z];
}

function serializeFaceTexture(cfg: FaceTextureConfig): Record<string, unknown> {
  return {
    image: stripDataUrl(cfg.url),
    repeat: [cfg.repeat.x, cfg.repeat.y],
    offset: [cfg.offset.x, cfg.offset.y],
    rotation: cfg.rotation,
  };
}

function serializeObject(o: SceneObjectInstance): Record<string, unknown> {
  const [r, g, b] = hexToRgb(o.color);

  const material: Record<string, unknown> = {
    preset: o.material,
    color: [r, g, b, o.opacity],
    roughness: o.roughness,
    metalness: o.metalness,
    transmission: o.transmission,
    ior: o.ior,
    clearcoat: o.clearcoat,
    opacity: o.opacity,
    reflectivity: o.reflectivity,
  };

  if (o.texture) {
    material.texture = {
      image: stripDataUrl(o.texture),
      repeat: [o.textureRepeat.x, o.textureRepeat.y],
      offset: [o.textureOffset.x, o.textureOffset.y],
      rotation: o.textureRotation,
    };
  }

  const faceTextures: Record<string, unknown> = {};
  for (const [face, cfg] of Object.entries(o.faceTextures)) {
    faceTextures[face] = serializeFaceTexture(cfg);
  }

  const obj: Record<string, unknown> = {
    id: o.id,
    name: o.name,
    geometry: o.type,
    visible: o.visible,
    transform: {
      position: vec3ToArr(o.position),
      rotation: vec3ToArr(o.rotation),
      scale: o.scale,
    },
    material,
  };
  if (o.customModelUrl) obj.mesh = o.customModelUrl;
  if (Object.keys(faceTextures).length > 0) obj.faceTextures = faceTextures;
  return obj;
}

function serializeSceneLight(l: SceneLight): Record<string, unknown> {
  const [r, g, b] = hexToRgb(l.color);
  return {
    id: l.id,
    name: l.name,
    position: vec3ToArr(l.position),
    color: [r, g, b],
    intensity: l.intensity,
    visible: l.visible,
    autoDetected: l.autoDetected,
  };
}

function serializeSurface(s: SurfacePlane): Record<string, unknown> {
  return {
    id: s.id,
    name: s.name,
    corners: s.corners.map((c) => [c.x, c.y]),
    position: vec3ToArr(s.position),
    rotation: vec3ToArr(s.rotation),
    width: s.size.width,
    depth: s.size.depth,
    visible: s.visible,
  };
}

/** Subset of `SceneState` that the serializer reads. Avoids pulling in the
 *  full store type (and its action signatures) here. */
export interface SerializableSceneState {
  backgroundImage: string | null;
  estimatedLighting: EstimatedLighting | null;
  objects: SceneObjectInstance[];
  sceneLights: SceneLight[];
  surfaces: SurfacePlane[];
  blendMode: BlendMode;
  brightness: number;
  lightAngle: number;
  lightElevation: number;
  lightColor: string;
  shadowOpacity: number;
  shadowSoftness: number;
  shadowColor: string;
}

export interface SidecarSceneOptions {
  /** Output pixel width. */
  width: number;
  /** Output pixel height. */
  height: number;
  /** Optional camera override sourced from the live Three.js camera. */
  camera?: {
    position: [number, number, number];
    target: [number, number, number];
    fov: number;
  };
}

/**
 * Convert the scene state into the JSON payload the native sidecar expects.
 *
 * Pure: no IO, no React/Three.js side effects. The shape must stay in
 * lockstep with `scene_from_json` in `sidecar_main.cpp` — extend both sides
 * when adding fields.
 */
export function buildSidecarScene(
  state: SerializableSceneState,
  opts: SidecarSceneOptions
): Record<string, unknown> {
  const [lr, lg, lb] = hexToRgb(state.lightColor);
  const [sr, sg, sb] = hexToRgb(state.shadowColor);

  let ambientColor: [number, number, number, number] = [0.4, 0.4, 0.4, 1];
  if (state.estimatedLighting) {
    const [ar, ag, ab] = hexToRgb(state.estimatedLighting.ambientColor);
    ambientColor = [ar, ag, ab, 1];
  }

  const scene: Record<string, unknown> = {
    width: opts.width,
    height: opts.height,
    background: stripDataUrl(state.backgroundImage),
    blendMode: state.blendMode,
    camera: opts.camera ?? {
      position: [2, 1.5, 2],
      target: [0, 0, 0],
      fov: 45,
    },
    objects: state.objects.map(serializeObject),
    light: {
      angle: state.lightAngle,
      elevation: state.lightElevation,
      intensity: state.brightness,
      color: [lr, lg, lb],
    },
    ambient: {
      color: ambientColor,
      intensity: 0.35,
    },
    pointLights: state.sceneLights.map(serializeSceneLight),
    shadow: {
      opacity: state.shadowOpacity,
      softness: state.shadowSoftness,
      color: [sr, sg, sb],
    },
    surfaces: state.surfaces.map(serializeSurface),
  };

  if (state.estimatedLighting) {
    scene.estimatedLighting = {
      brightness: state.estimatedLighting.brightness,
      lightAngle: state.estimatedLighting.lightAngle,
      lightElevation: state.estimatedLighting.lightElevation,
      contrast: state.estimatedLighting.contrast,
    };
  }

  return scene;
}
