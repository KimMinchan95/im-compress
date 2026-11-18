import { useEffect } from 'react'
import { matchBytes } from './match-bytes'
import { useEditorStore } from '../store/editor-store'
import type { EncodeRequest, EncodeResponse, OutputFormat } from '../types'

interface EncodeInput {
  source: Blob
  format: OutputFormat
  quality: number
  width: number
  height: number
}

let worker: Worker | null = null
let activeId = 0

function encodeOnce(input: EncodeInput, isCancelled: () => boolean) {
  const id = ++activeId
  worker?.terminate()

  const nextWorker = new Worker(new URL('../workers/encode.worker.ts', import.meta.url), {
    type: 'module',
  })
  worker = nextWorker

  return new Promise<Blob>((resolve, reject) => {
    nextWorker.onmessage = (event: MessageEvent<EncodeResponse>) => {
      if (event.data.id !== id) return
      if (isCancelled()) {
        reject(new Error('cancelled'))
        return
      }
      if (event.data.blob) resolve(event.data.blob)
      else reject(new Error('encode'))
    }

    nextWorker.onerror = () => {
      if (id !== activeId) return
      reject(new Error(isCancelled() ? 'cancelled' : 'encode'))
    }

    const request: EncodeRequest = { id, ...input }
    nextWorker.postMessage(request)
  })
}

export function useEncoder() {
  const source = useEditorStore((state) => state.source)
  const format = useEditorStore((state) => state.format)
  const quality = useEditorStore((state) => state.quality)
  const width = useEditorStore((state) => state.width)
  const height = useEditorStore((state) => state.height)
  const targetBytes = useEditorStore((state) => state.targetBytes)
  const retryToken = useEditorStore((state) => state.retryToken)
  const applyResult = useEditorStore((state) => state.applyResult)
  const applyMatched = useEditorStore((state) => state.applyMatched)
  const applyError = useEditorStore((state) => state.applyError)
  const beginEncode = useEditorStore((state) => state.beginEncode)

  useEffect(() => {
    if (!source || width < 1 || height < 1) return
    const current = useEditorStore.getState()
    if (current.targetBytes != null && current.matchedTarget === current.targetBytes) return

    let cancelled = false
    const isCancelled = () => cancelled
    beginEncode()

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const latest = useEditorStore.getState()
          const image = latest.source
          if (!image) return
          if (latest.targetBytes != null) {
            const matched = await matchBytes(
              (attempt) =>
                encodeOnce(
                  {
                    source: image.blob,
                    format: latest.format,
                    quality: attempt.quality,
                    width: attempt.width,
                    height: attempt.height,
                  },
                  isCancelled,
                ),
              {
                sourceWidth: image.width,
                sourceHeight: image.height,
                quality: latest.quality,
                targetBytes: latest.targetBytes,
              },
            )
            if (cancelled) return
            applyMatched({
              result: {
                url: URL.createObjectURL(matched.blob),
                bytes: matched.bytes,
                width: matched.width,
                height: matched.height,
                format: latest.format,
                quality: matched.quality,
              },
              quality: matched.quality,
              width: matched.width,
              height: matched.height,
              scale: matched.scale,
            })
            return
          }

          const blob = await encodeOnce(
            {
              source: image.blob,
              format: latest.format,
              quality: latest.quality,
              width: latest.width,
              height: latest.height,
            },
            isCancelled,
          )
          if (cancelled) return
          applyResult({
            url: URL.createObjectURL(blob),
            bytes: blob.size,
            width: latest.width,
            height: latest.height,
            format: latest.format,
            quality: latest.quality,
          })
        } catch (error) {
          if (cancelled || (error instanceof Error && error.message === 'cancelled')) return
          applyError('encode-failed')
        }
      })()
    }, 220)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      worker?.terminate()
      if (worker) worker = null
    }
  }, [
    source,
    format,
    quality,
    width,
    height,
    targetBytes,
    retryToken,
    applyResult,
    applyMatched,
    applyError,
    beginEncode,
  ])
}
