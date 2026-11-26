import { createWorkerClient } from './worker-client'
import type { HeicDecodeRequest } from '../types'

/** Separate from the encoder client so changing encode settings never cancels a HEIC decode. */
const heicWorker = createWorkerClient<Omit<HeicDecodeRequest, 'id'>>(
  () => new Worker(new URL('../workers/heic.worker.ts', import.meta.url), { type: 'module' }),
)

/**
 * Decodes HEIC/HEIF to PNG off the main thread. The main-thread decoder is only a fallback for
 * when the worker cannot handle the file, because it blocks rendering while it runs.
 */
export async function decodeHeic(file: Blob) {
  try {
    return await heicWorker.run({ source: file })
  } catch {
    const { heicTo } = await import('heic-to')
    return heicTo({ blob: file, type: 'image/png' })
  }
}
