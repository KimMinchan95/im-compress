import { keepDisplayP3, readDisplayP3Profile } from '../lib/color-profile'
import { FORMAT_META } from '../lib/files'
import type { EncodeRequest, EncodeResponse } from '../types'

const PNG_PIXEL_LIMIT = 16_777_216
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]

let quantizerWasm: Promise<typeof import('libimagequant-wasm/wasm/libimagequant_wasm.js')> | null = null

self.onmessage = async (event: MessageEvent<EncodeRequest>) => {
  const { id, source, format, quality, width, height } = event.data

  try {
    if (width < 1 || height < 1) throw new Error('size')

    const profile = format === 'png' ? null : await readDisplayP3Profile(source).catch(() => null)
    const bitmap = await createImageBitmap(source)
    if (format === 'png') {
      try {
        const blob = await quantizedPng(source, bitmap, width, height, quality)
        bitmap.close()
        const response: EncodeResponse = { id, blob }
        self.postMessage(response)
        return
      } catch {
        // The browser PNG encoder still produces a file if quantization cannot.
      }
    }

    const canvas = new OffscreenCanvas(width, height)
    const surface = drawingSurface(canvas, profile !== null)
    if (!surface) throw new Error('context')

    surface.context.imageSmoothingEnabled = true
    surface.context.imageSmoothingQuality = 'high'

    if (format === 'jpeg') {
      surface.context.fillStyle = '#ffffff'
      surface.context.fillRect(0, 0, width, height)
    }

    surface.context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const encoded = await canvas.convertToBlob({
      type: FORMAT_META[format].mime,
      quality: format === 'png' ? undefined : quality / 100,
    })
    const blob = profile && surface.keepProfile ? await keepDisplayP3(encoded, profile, width, height).catch(() => encoded) : encoded

    const response: EncodeResponse = { id, blob }
    self.postMessage(response)
  } catch {
    const response: EncodeResponse = { id }
    self.postMessage(response)
  }
}

async function quantizedPng(source: Blob, bitmap: ImageBitmap, width: number, height: number, quality: number) {
  if (width * height > PNG_PIXEL_LIMIT) throw new Error('large')
  const wasm = await loadQuantizer()
  const quantizer = new wasm.ImageQuantizer()
  const palette = paletteSettings(quality)
  try {
    quantizer.setMaxColors(palette.maxColors)
    quantizer.setSpeed(4)
    quantizer.setQuality(0, palette.target)
    if (bitmap.width === width && bitmap.height === height && (await isPng(source))) {
      const result = quantizer.quantizePng(new Uint8Array(await source.arrayBuffer()), palette.dither, 'none')
      return pngBlob(result.pngBytes)
    }

    const canvas = new OffscreenCanvas(width, height)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('context')
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(bitmap, 0, 0, width, height)
    const image = context.getImageData(0, 0, width, height)
    const raw = quantizer.quantizeImage(image.data, width, height)
    try {
      raw.setDithering(palette.dither)
      const indices = raw.getPaletteIndices(image.data, width, height)
      return pngBlob(wasm.encode_palette_to_png(indices, raw.getPalette(), width, height))
    } finally {
      raw.free()
    }
  } finally {
    quantizer.free()
  }
}

function paletteSettings(quality: number) {
  const level = Math.min(100, Math.max(0, Math.round(quality)))
  const maxColors = Math.max(2, Math.round(2 + (254 * level) / 100))
  const dither = level >= 85 ? 0.35 : level >= 60 ? 0.2 : level >= 40 ? 0.08 : 0
  return { maxColors, dither, target: Math.max(level, 1) }
}

async function loadQuantizer() {
  quantizerWasm ??= import('libimagequant-wasm/wasm/libimagequant_wasm.js').then(async (wasm) => {
    await wasm.default()
    return wasm
  })
  return quantizerWasm
}

async function isPng(blob: Blob) {
  const bytes = new Uint8Array(await blob.slice(0, PNG_SIGNATURE.length).arrayBuffer())
  return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)
}

function pngBlob(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return new Blob([copy], { type: 'image/png' })
}

function drawingSurface(canvas: OffscreenCanvas, wide: boolean) {
  if (wide) {
    try {
      const context = canvas.getContext('2d', { colorSpace: 'display-p3' })
      if (context) {
        return { context, keepProfile: keepsDisplayP3(context) }
      }
    } catch {
      return srgbSurface(canvas)
    }
  }

  return srgbSurface(canvas)
}

function keepsDisplayP3(context: OffscreenCanvasRenderingContext2D) {
  const withAttributes = context as OffscreenCanvasRenderingContext2D & {
    getContextAttributes?: () => { colorSpace?: string }
  }
  return withAttributes.getContextAttributes?.().colorSpace === 'display-p3'
}

function srgbSurface(canvas: OffscreenCanvas) {
  const context = canvas.getContext('2d')
  if (!context) return null
  return { context, keepProfile: false }
}
