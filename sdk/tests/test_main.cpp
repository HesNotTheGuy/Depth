/**
 * @file test_main.cpp
 * @brief Entry point for the Depth SDK test runner.
 *
 * All TEST_CASE() definitions in the linked test_*.cpp files
 * self-register via static initializers — main() just runs them.
 */

#include "test_harness.h"

int main() {
    return depth_test::run_all();
}
