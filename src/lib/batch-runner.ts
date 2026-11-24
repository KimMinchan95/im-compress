import { useEffect } from 'react'
import type { EncodeRequest, EncodeResponse } from '../types'
import { prepareQueue, useBatchStore, type BatchItem } from '../store/batch-store'
import { sizeFromScale } from './aspect'
import { FORMAT_META, ensureMime } from './files'
import { matchBytes } from './match-bytes'

let requestId = 0
let controller = new AbortController()
let workers: Worker[] = []

function stopBatch() {
  controller.abort()
  for (const worker of workers) worker.terminate()
  workers = []
  controller = new AbortController()
}

function claim() {
  const found: { job: BatchItem | null } = { job: null }
  useBatchStore.setState((state) => {
    if (state.editingId) return state
    const index = state.items.findIndex((item) => item.status === 'queued')
    if (index < 0) return state
    const items = state.items.slice()
    items[index] = { ...items[index], status: 'encoding' }
    found.job = items[index]
    return { items }
  })
  return found.job
}

function encodeOnce(
  worker: Worker,
  input: Omit<EncodeRequest, 'id'>,
  signal: AbortSignal,
) {
  const id = ++requestId
  return new Promise<Blob>((resolve, reject) => {
    const finish = (error?: Error, blob?: Blob) => {
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      signal.removeEventListener('abort', onAbort)
      if (blob) resolve(blob)
      else reject(error ?? new Error('encode'))
    }
    const onAbort = () => finish(new Error('cancelled'))
    const onError = () => finish(new Error(signal.aborted ? 'cancelled' : 'encode'))
    const onMessage = (event: MessageEvent<EncodeResponse>) => {
      if (event.data.id !== id) return
      if (signal.aborted) {
        finish(new Error('cancelled'))
        return
      }
      if (event.data.blob) finish(undefined, event.data.blob)
      else finish(new Error('encode'))
    }
    if (signal.aborted) {
      finish(new Error('cancelled'))
      return
    }
    signal.addEventListener('abort', onAbort, { once: true })
    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
    worker.postMessage({ id, ...input } satisfies EncodeRequest)
  })
}

async function encodeJob(worker: Worker, job: BatchItem, signal: AbortSignal) {
  const settings = job.settings
  const mime = FORMAT_META[settings.format].mime
  if (settings.sizeMode === 'bytes' && settings.targetBytes != null) {
    const matched = await matchBytes(
      (attempt) =>
        encodeOnce(
          worker,
          {
            source: job.bitmap,
            format: settings.format,
            quality: attempt.quality,
            width: attempt.width,
            height: attempt.height,
          },
          signal,
        ),
      {
        sourceWidth: job.width,
        sourceHeight: job.height,
        quality: settings.quality,
        targetBytes: settings.targetBytes,
      },
    )
    const blob = await ensureMime(matched.blob, mime)
    return {
      blob,
      bytes: blob.size,
      width: matched.width,
      height: matched.height,
      format: settings.format,
      quality: matched.quality,
      settings,
    }
  }

  const sized = sizeFromScale(job.width, job.height, settings.sizeMode === 'dimensions' ? settings.scale : 100)
  const encoded = await encodeOnce(
    worker,
    {
      source: job.bitmap,
      format: settings.format,
      quality: settings.quality,
      width: sized.width,
      height: sized.height,
    },
    signal,
  )
  const blob = await ensureMime(encoded, mime)
  return {
    blob,
    bytes: blob.size,
    width: sized.width,
    height: sized.height,
    format: settings.format,
    quality: settings.quality,
    settings,
  }
}

async function pump(worker: Worker, signal: AbortSignal, isCurrent: () => boolean) {
  try {
    while (isCurrent() && !signal.aborted) {
      const job = claim()
      if (!job) return
      try {
        const encoded = await encodeJob(worker, job, signal)
        if (!isCurrent() || signal.aborted) return
        useBatchStore.getState().finishItem(job.id, encoded)
      } catch (error) {
        if (!isCurrent() || signal.aborted || (error instanceof Error && error.message === 'cancelled')) return
        useBatchStore.getState().failItem(job.id)
      }
    }
  } finally {
    worker.terminate()
  }
}

function runPool(isCurrent: () => boolean) {
  const signal = controller.signal
  const pool = [0, 1].map(
    () => new Worker(new URL('../workers/encode.worker.ts', import.meta.url), { type: 'module' }),
  )
  workers = pool
  return Promise.all(pool.map((worker) => pump(worker, signal, isCurrent)))
}

export function useBatchRunner() {
  const format = useBatchStore((state) => state.settings.format)
  const quality = useBatchStore((state) => state.settings.quality)
  const scale = useBatchStore((state) => state.settings.scale)
  const sizeMode = useBatchStore((state) => state.settings.sizeMode)
  const targetBytes = useBatchStore((state) => state.settings.targetBytes)
  const jobVersion = useBatchStore((state) => state.jobVersion)
  const editingId = useBatchStore((state) => state.editingId)
  const delay = useBatchStore((state) => state.delay)

  useEffect(() => {
    if (editingId || useBatchStore.getState().items.length === 0) return
    let alive = true
    const timer = window.setTimeout(() => {
      if (!alive) return
      prepareQueue()
      if (!useBatchStore.getState().items.some((item) => item.status === 'queued')) return
      void runPool(() => alive)
    }, delay)

    return () => {
      alive = false
      window.clearTimeout(timer)
      stopBatch()
    }
  }, [delay, editingId, format, jobVersion, quality, scale, sizeMode, targetBytes])
}
