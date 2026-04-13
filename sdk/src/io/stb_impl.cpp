/**
 * stb_image and stb_image_write implementations.
 *
 * This file exists solely to compile the stb single-header libraries
 * exactly once. Do not include STB_IMAGE_IMPLEMENTATION elsewhere.
 */

#define STB_IMAGE_IMPLEMENTATION
#define STB_IMAGE_WRITE_IMPLEMENTATION

#ifdef _MSC_VER
#pragma warning(push)
#pragma warning(disable: 4244 4996)
#endif

#include "stb_image.h"
#include "stb_image_write.h"

#ifdef _MSC_VER
#pragma warning(pop)
#endif
