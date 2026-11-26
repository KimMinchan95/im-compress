import type { ZipEntry } from './zip'
import { createWorkerClient } from './worker-client'

const zipWorker = createWorkerClient<{ entries: ZipEntry[] }>(
  () => new Worker(new URL('../workers/zip.worker.ts', import.meta.url), { type: 'module' }),
)

/** Packs the given images into a ZIP on a worker and resolves with the archive blob. */
export function zipInWorker(entries: ZipEntry[]) {
  return zipWorker.run({ entries })
}
