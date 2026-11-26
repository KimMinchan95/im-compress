import type { EncodeResponse, HeicDecodeRequest } from '../types'

/**
 * Dedicated HEIC decoder. Kept out of the encode worker so that its large decoder bundle is
 * only downloaded and parsed when a HEIC file is actually opened.
 * `heic-to/next` is the worker-safe entry point of the library.
 */
self.onmessage = async (event: MessageEvent<HeicDecodeRequest>) => {
  const { id, source } = event.data
  try {
    const { heicTo } = await import('heic-to/next')
    const blob = await heicTo({ blob: source, type: 'image/png' })
    const response: EncodeResponse = { id, blob }
    self.postMessage(response)
  } catch (error) {
    const response: EncodeResponse = {
      id,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    }
    self.postMessage(response)
  }
}
