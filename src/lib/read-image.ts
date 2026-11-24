import { decodeHeic } from './decode-heic'
import { isHeicFile } from './files'

export interface OpenedImage {
  blob: Blob
  width: number
  height: number
}

export async function readImage(file: File): Promise<OpenedImage> {
  const native = await measure(file).catch(() => null)
  if (native) return { blob: file, width: native.width, height: native.height }
  if (!isHeicFile(file)) throw new Error('unreadable')

  const decoded = await decodeHeic(file)
  const size = await measure(decoded)
  return { blob: decoded, width: size.width, height: size.height }
}

async function measure(blob: Blob) {
  const bitmap = await createImageBitmap(blob)
  try {
    if (bitmap.width < 1 || bitmap.height < 1) throw new Error('empty')
    return { width: bitmap.width, height: bitmap.height }
  } finally {
    bitmap.close()
  }
}
