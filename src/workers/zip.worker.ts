import { zipStored, type ZipEntry } from '../lib/zip'
import type { EncodeResponse } from '../types'

interface ZipRequest {
  id: number
  entries: ZipEntry[]
}

/**
 * Builds the batch ZIP off the main thread. CRC32 over every byte is CPU-heavy, so doing it on
 * the UI thread froze the page for large batches.
 */
self.onmessage = async (event: MessageEvent<ZipRequest>) => {
  const { id, entries } = event.data
  try {
    const blob = await zipStored(entries)
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
