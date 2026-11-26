import { useEffect } from 'react'
import { createDownloadId, publishDownload } from './download-bridge'
import { FORMAT_META, ensureMime } from './files'
import { matchBytes } from './match-bytes'
import { createWorkerClient } from './worker-client'
import { useEditorStore } from '../store/editor-store'
import type { EncodeRequest } from '../types'

type EncodeInput = Omit<EncodeRequest, 'id'>

/** One long-lived encode worker for the editor; see `worker-client.ts`. */
const encoder = createWorkerClient<EncodeInput>(
  () => new Worker(new URL('../workers/encode.worker.ts', import.meta.url), { type: 'module' }),
)

function encodeOnce(input: EncodeInput) {
  return encoder.run(input)
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
    beginEncode()

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const latest = useEditorStore.getState()
          const image = latest.source
          if (!image) return

          if (latest.targetBytes != null) {
            // Size search skips the expensive PNG optimiser; only the final result gets it.
            const matched = await matchBytes(
              (attempt) =>
                encodeOnce({
                  source: image.blob,
                  format: latest.format,
                  quality: attempt.quality,
                  width: attempt.width,
                  height: attempt.height,
                  optimize: false,
                }),
              {
                sourceWidth: image.width,
                sourceHeight: image.height,
                quality: latest.quality,
                targetBytes: latest.targetBytes,
              },
            )
            if (cancelled) return

            const finalBlob =
              latest.format === 'png'
                ? await encodeOnce({
                    source: image.blob,
                    format: latest.format,
                    quality: matched.quality,
                    width: matched.width,
                    height: matched.height,
                    optimize: true,
                  })
                : matched.blob
            if (cancelled) return

            const matchedBlob = await ensureMime(finalBlob, FORMAT_META[latest.format].mime)
            if (cancelled) return

            const matchedDownloadId = createDownloadId()
            await publishDownload(matchedDownloadId, matchedBlob, FORMAT_META[latest.format].mime)
            if (cancelled) return

            applyMatched({
              result: {
                url: URL.createObjectURL(matchedBlob),
                blob: matchedBlob,
                downloadId: matchedDownloadId,
                bytes: matchedBlob.size,
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

          const blob = await encodeOnce({
            source: image.blob,
            format: latest.format,
            quality: latest.quality,
            width: latest.width,
            height: latest.height,
          })
          if (cancelled) return
          const typed = await ensureMime(blob, FORMAT_META[latest.format].mime)
          if (cancelled) return
          const downloadId = createDownloadId()
          await publishDownload(downloadId, typed, FORMAT_META[latest.format].mime)
          if (cancelled) return
          applyResult({
            url: URL.createObjectURL(typed),
            blob: typed,
            downloadId,
            bytes: typed.size,
            width: latest.width,
            height: latest.height,
            format: latest.format,
            quality: latest.quality,
          })
        } catch (error) {
          if (cancelled || (error instanceof Error && error.message === 'cancelled')) return
          console.warn('[encode] failed:', error)
          applyError('encode-failed')
        }
      })()
    }, 220)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      encoder.cancel()
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
