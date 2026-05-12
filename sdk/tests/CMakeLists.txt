# Depth SDK test suite — single binary, in-tree harness, no external deps.

add_executable(depth_tests
    test_main.cpp
    test_geometry.cpp
    test_scene.cpp
    test_lighting_estimator.cpp
    test_c_api.cpp
    test_compositor.cpp
    test_golden.cpp
)

target_link_libraries(depth_tests PRIVATE depth)
target_include_directories(depth_tests PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_SOURCE_DIR}/include
)

if(MSVC)
    target_compile_options(depth_tests PRIVATE /W4 /wd4100 /wd4189)
    target_compile_definitions(depth_tests PRIVATE _USE_MATH_DEFINES NOMINMAX)
else()
    target_compile_options(depth_tests PRIVATE -Wall -Wextra -Wno-unused-parameter)
endif()

enable_testing()
add_test(NAME depth_unit COMMAND depth_tests)
