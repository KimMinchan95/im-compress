import { keepDisplayP3, readDisplayP3Profile } from '../lib/color-profile'
import { FORMAT_META } from '../lib/files'
import type { EncodeRequest, EncodeResponse } from '../types'

self.onmessage = async (event: MessageEvent<EncodeRequest>) => {
  const { id, source, format, quality, width, height } = event.data

  try {
    if (width < 1 || height < 1) throw new Error('size')

    const profile = await readDisplayP3Profile(source).catch(() => null)
    const bitmap = await createImageBitmap(source)
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
