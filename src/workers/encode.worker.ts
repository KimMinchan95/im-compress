import { FORMAT_META } from '../lib/files'
import type { EncodeRequest, EncodeResponse } from '../types'

self.onmessage = async (event: MessageEvent<EncodeRequest>) => {
  const { id, source, format, quality, width, height } = event.data

  try {
    if (width < 1 || height < 1) throw new Error('size')

    const bitmap = await createImageBitmap(source)
    const canvas = new OffscreenCanvas(width, height)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('context')

    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'

    if (format === 'jpeg') {
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, width, height)
    }

    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const blob = await canvas.convertToBlob({
      type: FORMAT_META[format].mime,
      quality: format === 'png' ? undefined : quality / 100,
    })

    const response: EncodeResponse = { id, blob }
    self.postMessage(response)
  } catch {
    const response: EncodeResponse = { id }
    self.postMessage(response)
  }
}
