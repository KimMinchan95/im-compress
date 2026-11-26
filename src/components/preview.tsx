import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { formatBytes, savingsOf } from '../lib/format-bytes'
import { isResultCurrent } from '../lib/files'
import { useI18n } from '../lib/use-i18n'
import { useEditorStore } from '../store/editor-store'
import { useStageStore } from '../store/stage-store'
import { ImageStage } from './image-stage'

export function Preview() {
  const isFullscreen = useStageStore((state) => state.isFullscreen)
  const closeFullscreen = useStageStore((state) => state.closeFullscreen)
  const source = useEditorStore((state) => state.source)
  const result = useEditorStore((state) => state.result)
  const caption = useSavingsCaption()

  if (!source) return null

  return (
    <section className="enter relative flex min-h-0 w-full min-w-0 flex-1 flex-col px-3 py-2 md:px-4 md:py-3">
      <div className="orb orb-c" />
      <div className="relative z-10 flex min-h-0 w-full flex-1 flex-col">
        <ImageStage
          originalUrl={source.url}
          resultUrl={result?.url ?? null}
          width={source.width}
          height={source.height}
          layout="page"
          caption={caption}
        />
      </div>
      {isFullscreen ? createPortal(<Fullscreen onClose={closeFullscreen} />, document.body) : null}
    </section>
  )
}

function useSavingsCaption() {
  const { t } = useI18n()
  const source = useEditorStore((state) => state.source)
  const result = useEditorStore((state) => state.result)
  const status = useEditorStore((state) => state.status)
  const width = useEditorStore((state) => state.width)
  const height = useEditorStore((state) => state.height)
  const format = useEditorStore((state) => state.format)
  const quality = useEditorStore((state) => state.quality)
  if (!source) return ''
  // A failed encode must not keep showing "계산 중"; the controls panel explains the failure.
  if (status === 'error') return t('encodeFailed')

  const isCurrent = result ? isResultCurrent(result, { format, width, height, quality }) : false
  if (!result || !isCurrent || status === 'encoding') {
    return `${formatBytes(source.bytes)} → ${t('calculating')}`
  }

  const savings = savingsOf(source.bytes, result.bytes)
  const summary =
    savings.kind === 'smaller'
      ? t('smaller')(savings.percent)
      : savings.kind === 'larger'
        ? t('larger')(savings.percent)
        : t('sameSize')
  return `${formatBytes(source.bytes)} → ${formatBytes(result.bytes)} · ${summary}`
}

function Fullscreen({ onClose }: { onClose: () => void }) {
  const frameRef = useRef<HTMLDivElement>(null)
  const source = useEditorStore((state) => state.source)
  const result = useEditorStore((state) => state.result)
  const caption = useSavingsCaption()

  useEffect(() => {
    const node = frameRef.current
    let entered = false
    void node?.requestFullscreen?.().catch(() => undefined)
    const onChange = () => {
      if (document.fullscreenElement) {
        entered = true
        return
      }
      if (entered) onClose()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.fullscreenElement) onClose()
    }
    document.addEventListener('fullscreenchange', onChange)
    window.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      if (document.fullscreenElement === node) void document.exitFullscreen()
    }
  }, [onClose])

  if (!source) return null

  return (
    <div ref={frameRef} className="overlay-in fixed inset-0 z-40 flex flex-col overflow-hidden bg-ink px-4 py-4">
      <div className="flex min-h-0 flex-1">
        <ImageStage
          originalUrl={source.url}
          resultUrl={result?.url ?? null}
          width={source.width}
          height={source.height}
          layout="fullscreen"
          caption={caption}
        />
      </div>
    </div>
  )
}
