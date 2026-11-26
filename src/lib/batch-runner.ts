import { useEffect } from 'react'
import type { EncodeRequest } from '../types'
import { prepareQueue, useBatchStore, type BatchItem } from '../store/batch-store'
import { sizeFromScale } from './aspect'
import { FORMAT_META, ensureMime } from './files'
import { matchBytes } from './match-bytes'
import { createWorkerClient, type WorkerClient } from './worker-client'

type EncodeInput = Omit<EncodeRequest, 'id'>
type Encoder = WorkerClient<EncodeInput>

const POOL_SIZE = 2
let controller = new AbortController()
let encoders: Encoder[] = []

function createEncoder(): Encoder {
  return createWorkerClient<EncodeInput>(
    () => new Worker(new URL('../workers/encode.worker.ts', import.meta.url), { type: 'module' }),
  )
}

/** Aborts the queue and cancels in-flight encodes; their pending promises reject with `cancelled`. */
function stopBatch() {
  controller.abort()
  for (const encoder of encoders) encoder.cancel()
  encoders = []
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

async function encodeJob(encoder: Encoder, job: BatchItem) {
  const settings = job.settings
  const mime = FORMAT_META[settings.format].mime
  if (settings.sizeMode === 'bytes' && settings.targetBytes != null) {
    // The size search skips the PNG optimiser; only the chosen result is optimised below.
    const matched = await matchBytes(
      (attempt) =>
        encoder.run({
          source: job.bitmap,
          format: settings.format,
          quality: attempt.quality,
          width: attempt.width,
          height: attempt.height,
          optimize: false,
        }),
      {
        sourceWidth: job.width,
        sourceHeight: job.height,
        quality: settings.quality,
        targetBytes: settings.targetBytes,
      },
    )
    const finalBlob =
      settings.format === 'png'
        ? await encoder.run({
            source: job.bitmap,
            format: settings.format,
            quality: matched.quality,
            width: matched.width,
            height: matched.height,
            optimize: true,
          })
        : matched.blob
    const blob = await ensureMime(finalBlob, mime)
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
  const encoded = await encoder.run({
    source: job.bitmap,
    format: settings.format,
    quality: settings.quality,
    width: sized.width,
    height: sized.height,
  })
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

async function pump(encoder: Encoder, signal: AbortSignal, isCurrent: () => boolean) {
  try {
    while (isCurrent() && !signal.aborted) {
      const job = claim()
      if (!job) return
      try {
        const encoded = await encodeJob(encoder, job)
        if (!isCurrent() || signal.aborted) return
        useBatchStore.getState().finishItem(job.id, encoded)
      } catch (error) {
        if (!isCurrent() || signal.aborted || (error instanceof Error && error.message === 'cancelled')) return
        useBatchStore.getState().failItem(job.id)
      }
    }
  } finally {
    encoder.cancel()
  }
}

function runPool(isCurrent: () => boolean) {
  const signal = controller.signal
  encoders = Array.from({ length: POOL_SIZE }, () => createEncoder())
  return Promise.all(encoders.map((encoder) => pump(encoder, signal, isCurrent)))
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
