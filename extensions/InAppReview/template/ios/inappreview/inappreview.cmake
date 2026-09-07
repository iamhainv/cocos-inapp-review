# InAppReview extension — iOS CMake build rules.
#
# Mirrors the structure and variable conventions of share.cmake.
# Key differences from share.cmake:
#   * StoreKit.framework is required (SKStoreReviewController) — linked
#     explicitly below. UIKit is NOT needed directly; it's already linked
#     transitively through the engine target.
#   * NO xcframework — ReviewServiceHub.mm uses only StoreKit + Foundation,
#     both of which are system frameworks; no third-party static or dynamic lib.
#   * NO ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES flag required — implementation
#     is pure ObjC (no Swift, no ARC-free C++ interop layer needed).
#
# Minimum iOS deployment target: iOS 10.3 (SKStoreReviewController first
# appeared in iOS 10.3). The scene-based API path requires iOS 14+; the code
# falls back to the no-scene API on older OS versions, so the build target
# stays at the project's existing minimum (≥ 13.0 per share.cmake).

# ---------------------------------------------------------------------------
# 1. Collect ObjC bridge sources
# ---------------------------------------------------------------------------

set(INAPPREVIEW_PROJ_SOURCES)

list(APPEND INAPPREVIEW_PROJ_SOURCES
    ${CMAKE_CURRENT_LIST_DIR}/ReviewServiceHub.mm
    ${CMAKE_CURRENT_LIST_DIR}/ReviewServiceHub.h
)

source_group(TREE ${CMAKE_CURRENT_LIST_DIR} PREFIX "Source Files" FILES ${INAPPREVIEW_PROJ_SOURCES})

# Enable ARC on every source file (mirrors share.cmake per-file approach).
foreach(file ${INAPPREVIEW_PROJ_SOURCES})
    set_source_files_properties(${file} PROPERTIES COMPILE_OPTIONS "-fobjc-arc")
endforeach()

# ---------------------------------------------------------------------------
# 2. Build the bridge as a static library
# ---------------------------------------------------------------------------

add_library(inappreview ${INAPPREVIEW_PROJ_SOURCES})

target_include_directories(inappreview PRIVATE
    ${CMAKE_CURRENT_LIST_DIR}
)

# ---------------------------------------------------------------------------
# 3. Link system frameworks
#
# StoreKit is required for SKStoreReviewController. Foundation is already
# linked transitively through the engine, but named here for clarity.
# ---------------------------------------------------------------------------

target_link_libraries(inappreview "-framework StoreKit")
target_link_libraries(inappreview "-framework Foundation")

# ---------------------------------------------------------------------------
# 4. Link engine and wire inappreview into the final executable
# ---------------------------------------------------------------------------

target_link_libraries(inappreview ${ENGINE_NAME})
target_include_directories(${EXECUTABLE_NAME} PUBLIC ${CMAKE_CURRENT_LIST_DIR})
target_link_libraries(${EXECUTABLE_NAME} inappreview)

# Force-load ensures +load / constructor functions inside the static lib run
# even if no symbol from the lib is directly referenced.
target_link_options(${EXECUTABLE_NAME} PRIVATE -ObjC)
