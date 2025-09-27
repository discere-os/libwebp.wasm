project('libwebp.wasm', 'c', version: '1.4.0', meson_version: '>=1.3.0', default_options: ['buildtype=release'])

fs = import('fs')

if get_option('simd')
  add_project_arguments('-msimd128', language: 'c')
endif

incs = include_directories('src', 'src/webp', 'src/dec', 'src/enc', 'src/dsp', 'src/utils', 'src/mux', 'src/demux')
core_sources = []
core_sources += fs.glob('src/dec/*.c')
core_sources += fs.glob('src/enc/*.c')
core_sources += fs.glob('src/dsp/*.c')
core_sources += fs.glob('src/utils/*.c')
core_sources += fs.glob('src/mux/*.c')
core_sources += fs.glob('src/demux/*.c')

core = static_library('libwebp_core', core_sources, include_directories: incs)

if get_option('main_module')
  executable('libwebp-main', 'src/libwebp_wasm_module.c',
    link_with: core,
    include_directories: incs,
    install: true,
    link_args: [
      '--no-entry',
      '-sMODULARIZE=1',
      '-sEXPORT_ES6=1',
      '-sALLOW_MEMORY_GROWTH=1',
      '-sENVIRONMENT=web,webview,worker',
      '-sNO_FILESYSTEM=1',
      '-sEXPORTED_RUNTIME_METHODS=["cwrap","ccall","UTF8ToString"]',
      '-sEXPORTED_FUNCTIONS=@' + meson.project_source_root() / get_option('exports'),
    ])
endif

if get_option('side_module')
  shared_module('libwebp-side', 'src/libwebp_wasm_side.c',
    link_whole: core,
    include_directories: incs,
    install: true,
    link_args: ['-sSIDE_MODULE=2', '-fPIC'])
endif

