import { useEffect } from 'react'
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

function requestEncode(input: EncodeInput, onSuccess: (blob: Blob) => void, onError: () => void) {
  const id = ++activeId
  worker?.terminate()

  const nextWorker = new Worker(new URL('../workers/encode.worker.ts', import.meta.url), {
    type: 'module',
  })
  worker = nextWorker

  nextWorker.onmessage = (event: MessageEvent<EncodeResponse>) => {
    if (event.data.id !== id) return
    if (event.data.blob) onSuccess(event.data.blob)
    else onError()
  }

  nextWorker.onerror = () => {
    if (id !== activeId) return
    onError()
  }

  const request: EncodeRequest = { id, ...input }
  nextWorker.postMessage(request)

  return () => {
    if (activeId !== id) return
    nextWorker.terminate()
    if (worker === nextWorker) worker = null
  }
}

export function useEncoder() {
  const source = useEditorStore((state) => state.source)
  const format = useEditorStore((state) => state.format)
  const quality = useEditorStore((state) => state.quality)
  const width = useEditorStore((state) => state.width)
  const height = useEditorStore((state) => state.height)
  const retryToken = useEditorStore((state) => state.retryToken)
  const applyResult = useEditorStore((state) => state.applyResult)
  const applyError = useEditorStore((state) => state.applyError)
  const beginEncode = useEditorStore((state) => state.beginEncode)

  useEffect(() => {
    if (!source || width < 1 || height < 1) return

    let cancelEncode = () => { }
    let cancelled = false
    beginEncode()

    const timer = window.setTimeout(() => {
      if (cancelled) return
      cancelEncode = requestEncode(
        { source: source.blob, format, quality, width, height },
        (blob) => {
          if (cancelled) return
          applyResult({
            url: URL.createObjectURL(blob),
            bytes: blob.size,
            width,
            height,
            format,
            quality,
          })
        },
        () => {
          if (cancelled) return
          applyError('encode-failed')
        },
      )
    }, 200)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      cancelEncode()
    }
  }, [source, format, quality, width, height, retryToken, applyResult, applyError, beginEncode])
}
