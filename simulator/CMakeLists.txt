cmake_minimum_required(VERSION 3.15)
project(Aletheia LANGUAGES C CXX)

set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_SOURCE_DIR}/build)

file(GLOB VREMU6502_SOURCES
    ${CMAKE_SOURCE_DIR}/lib/vrEmu6502/src/*.c
    ${CMAKE_SOURCE_DIR}/lib/vrEmu6502/src/*.h
)

file(GLOB VREMU6522_SOURCES
    ${CMAKE_SOURCE_DIR}/lib/vrEmu6522/src/*.c
    ${CMAKE_SOURCE_DIR}/lib/vrEmu6522/src/*.h
)

file(GLOB VREMULCD_SOURCES
    ${CMAKE_SOURCE_DIR}/lib/vrEmuLcd/src/*.c
    ${CMAKE_SOURCE_DIR}/lib/vrEmuLcd/src/*.h
)

add_library(VrEmu6502 STATIC ${VREMU6502_SOURCES})
add_library(VrEmu6522 STATIC ${VREMU6522_SOURCES})
add_library(VrEmuLcd STATIC ${VREMULCD_SOURCES})

set_target_properties(VrEmu6502 PROPERTIES LINKER_LANGUAGE C)
set_target_properties(VrEmu6522 PROPERTIES LINKER_LANGUAGE C)
set_target_properties(VrEmuLcd PROPERTIES LINKER_LANGUAGE C)

target_include_directories(VrEmu6502 PUBLIC ${CMAKE_SOURCE_DIR}/lib/vrEmu6502/src)
target_include_directories(VrEmu6522 PUBLIC ${CMAKE_SOURCE_DIR}/lib/vrEmu6522/src)
target_include_directories(VrEmuLcd PUBLIC ${CMAKE_SOURCE_DIR}/lib/vrEmuLcd/src)

file(GLOB SOURCES
    ${CMAKE_SOURCE_DIR}/*.cpp
    ${CMAKE_SOURCE_DIR}/*.h
)

add_link_options(
    -sEXPORTED_FUNCTIONS=_malloc,_free,_load_code
    -sEXPORTED_RUNTIME_METHODS=HEAPU8,cwrap
)

add_executable(aletheia ${SOURCES})

target_compile_options(aletheia PRIVATE
    -Wno-main
)

set_target_properties(aletheia PROPERTIES LINK_FLAGS "--bind")

target_link_libraries(aletheia PRIVATE VrEmu6502 VrEmu6522 VrEmuLcd)