import mozjpegWasmUrl from '@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm?url'
import webpWasmUrl from '@jsquash/webp/codec/enc/webp_enc.wasm?url'
import webpSimdWasmUrl from '@jsquash/webp/codec/enc/webp_enc_simd.wasm?url'
import oxipngWasmUrl from '@jsquash/oxipng/codec/pkg/squoosh_oxipng_bg.wasm?url'

/**
 * Lazily loaded WASM encoders. Each codec is only downloaded and instantiated
 * the first time it is needed inside a worker.
 *
 * The emscripten glue resolves its `.wasm` file through `import.meta.url`, which
 * is not reliable once Vite bundles the dependency. We therefore map each wasm
 * file name to the URL Vite emitted for it.
 */
const EMSCRIPTEN_WASM: Record<string, string> = {
  'mozjpeg_enc.wasm': mozjpegWasmUrl,
  'webp_enc.wasm': webpWasmUrl,
  'webp_enc_simd.wasm': webpSimdWasmUrl,
}

function locateEmscriptenFile(path: string) {
  return EMSCRIPTEN_WASM[path] ?? path
}

type JpegModule = typeof import('@jsquash/jpeg/encode')
type WebpModule = typeof import('@jsquash/webp/encode')
type OxipngModule = typeof import('@jsquash/oxipng/optimise')

export type JpegEncodeOptions = Partial<import('@jsquash/jpeg/meta').EncodeOptions>
export type WebpEncodeOptions = Partial<import('@jsquash/webp/meta').EncodeOptions>

let jpegModule: Promise<JpegModule> | null = null
let webpModule: Promise<WebpModule> | null = null
let oxipngModule: Promise<OxipngModule> | null = null

/** Loads the MozJPEG encoder once per worker. */
export function loadJpegEncoder() {
  jpegModule ??= import('@jsquash/jpeg/encode').then(async (module) => {
    await module.init({ locateFile: locateEmscriptenFile })
    return module
  })
  return jpegModule
}

/** Loads the libwebp encoder once per worker (SIMD build is picked automatically). */
export function loadWebpEncoder() {
  webpModule ??= import('@jsquash/webp/encode').then(async (module) => {
    await module.init({ locateFile: locateEmscriptenFile })
    return module
  })
  return webpModule
}

/** Loads the oxipng optimiser once per worker. */
export function loadOxipng() {
  oxipngModule ??= import('@jsquash/oxipng/optimise').then(async (module) => {
    await module.init(oxipngWasmUrl)
    return module
  })
  return oxipngModule
}
