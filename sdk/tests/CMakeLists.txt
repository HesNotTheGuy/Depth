# Tests — uses a simple main() for now, no framework dependency
add_executable(depth_tests test_main.cpp)
target_link_libraries(depth_tests PRIVATE depth)
