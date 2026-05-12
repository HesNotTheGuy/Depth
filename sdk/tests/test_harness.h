/**
 * @file test_harness.h
 * @brief Minimal self-registering test harness for the Depth SDK.
 *
 * Usage:
 *   #include "test_harness.h"
 *
 *   TEST_CASE(my_test) {
 *       ASSERT_EQ(1 + 1, 2);
 *       ASSERT_NEAR(3.14f, 3.14159f, 0.01f);
 *       ASSERT_TRUE(condition);
 *   }
 *
 *   int main() { return depth_test::run_all(); }
 *
 * Single-header, no external dependencies, no STL exceptions required.
 */

#pragma once

#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>

namespace depth_test {

using TestFn = void(*)(int& failures, int& assertions);

struct TestCase {
    const char* name;
    TestFn fn;
};

inline std::vector<TestCase>& registry() {
    static std::vector<TestCase> r;
    return r;
}

struct Registrar {
    Registrar(const char* name, TestFn fn) {
        registry().push_back({name, fn});
    }
};

inline int run_all() {
    int total_failures = 0;
    int total_assertions = 0;
    int failed_cases = 0;
    int passed_cases = 0;

    std::printf("Depth SDK Tests (%zu cases)\n", registry().size());
    std::printf("================\n");

    for (auto& tc : registry()) {
        int local_failures = 0;
        int local_assertions = 0;
        std::printf("  [run ] %s\n", tc.name);
        tc.fn(local_failures, local_assertions);
        total_failures += local_failures;
        total_assertions += local_assertions;
        if (local_failures == 0) {
            std::printf("  [PASS] %s (%d asserts)\n", tc.name, local_assertions);
            passed_cases++;
        } else {
            std::printf("  [FAIL] %s (%d failures / %d asserts)\n",
                        tc.name, local_failures, local_assertions);
            failed_cases++;
        }
    }

    std::printf("================\n");
    std::printf("Cases: %d passed, %d failed | Assertions: %d total, %d failed\n",
                passed_cases, failed_cases, total_assertions, total_failures);
    return total_failures == 0 ? 0 : 1;
}

inline void report_failure(int& failures, const char* file, int line,
                           const char* expr, const std::string& detail) {
    std::fprintf(stderr, "    ASSERT FAIL %s:%d  %s\n", file, line, expr);
    if (!detail.empty()) {
        std::fprintf(stderr, "        %s\n", detail.c_str());
    }
    failures++;
}

template <typename A, typename B>
inline std::string fmt_eq(const A& a, const B& b) {
    char buf[128];
    if constexpr (std::is_floating_point_v<A> || std::is_floating_point_v<B>) {
        std::snprintf(buf, sizeof(buf), "got %.6g, expected %.6g",
                      (double)a, (double)b);
    } else {
        std::snprintf(buf, sizeof(buf), "got %lld, expected %lld",
                      (long long)a, (long long)b);
    }
    return buf;
}

inline std::string fmt_near(double a, double b, double eps) {
    char buf[160];
    std::snprintf(buf, sizeof(buf),
                  "got %.6g, expected %.6g +/- %.6g (diff %.6g)",
                  a, b, eps, std::fabs(a - b));
    return buf;
}

} // namespace depth_test

// ── Macros ──────────────────────────────────────────────

#define DEPTH_CONCAT_(a, b) a##b
#define DEPTH_CONCAT(a, b) DEPTH_CONCAT_(a, b)

#define TEST_CASE(name)                                                              \
    static void DEPTH_CONCAT(test_, name)(int& _failures, int& _assertions);         \
    static ::depth_test::Registrar DEPTH_CONCAT(reg_, name)                          \
        (#name, &DEPTH_CONCAT(test_, name));                                         \
    static void DEPTH_CONCAT(test_, name)(int& _failures, int& _assertions)

#define ASSERT_TRUE(expr)                                                            \
    do {                                                                             \
        _assertions++;                                                               \
        if (!(expr)) {                                                               \
            ::depth_test::report_failure(_failures, __FILE__, __LINE__,              \
                "ASSERT_TRUE(" #expr ")", "");                                       \
        }                                                                            \
    } while (0)

#define ASSERT_FALSE(expr)                                                           \
    do {                                                                             \
        _assertions++;                                                               \
        if ((expr)) {                                                                \
            ::depth_test::report_failure(_failures, __FILE__, __LINE__,              \
                "ASSERT_FALSE(" #expr ")", "");                                      \
        }                                                                            \
    } while (0)

#define ASSERT_EQ(a, b)                                                              \
    do {                                                                             \
        _assertions++;                                                               \
        auto _av = (a);                                                              \
        auto _bv = (b);                                                              \
        if (!(_av == _bv)) {                                                         \
            ::depth_test::report_failure(_failures, __FILE__, __LINE__,              \
                "ASSERT_EQ(" #a ", " #b ")",                                         \
                ::depth_test::fmt_eq(_av, _bv));                                     \
        }                                                                            \
    } while (0)

#define ASSERT_NEAR(a, b, eps)                                                       \
    do {                                                                             \
        _assertions++;                                                               \
        double _av = static_cast<double>(a);                                         \
        double _bv = static_cast<double>(b);                                         \
        double _ev = static_cast<double>(eps);                                       \
        if (std::fabs(_av - _bv) > _ev) {                                            \
            ::depth_test::report_failure(_failures, __FILE__, __LINE__,              \
                "ASSERT_NEAR(" #a ", " #b ", " #eps ")",                             \
                ::depth_test::fmt_near(_av, _bv, _ev));                              \
        }                                                                            \
    } while (0)

#define ASSERT_GT(a, b)                                                              \
    do {                                                                             \
        _assertions++;                                                               \
        auto _av = (a);                                                              \
        auto _bv = (b);                                                              \
        if (!(_av > _bv)) {                                                          \
            ::depth_test::report_failure(_failures, __FILE__, __LINE__,              \
                "ASSERT_GT(" #a ", " #b ")",                                         \
                ::depth_test::fmt_eq(_av, _bv));                                     \
        }                                                                            \
    } while (0)

#define ASSERT_LT(a, b)                                                              \
    do {                                                                             \
        _assertions++;                                                               \
        auto _av = (a);                                                              \
        auto _bv = (b);                                                              \
        if (!(_av < _bv)) {                                                          \
            ::depth_test::report_failure(_failures, __FILE__, __LINE__,              \
                "ASSERT_LT(" #a ", " #b ")",                                         \
                ::depth_test::fmt_eq(_av, _bv));                                     \
        }                                                                            \
    } while (0)
