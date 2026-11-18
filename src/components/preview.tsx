import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatBytes, savingsOf } from '../lib/format-bytes'
import { isResultCurrent } from '../lib/files'
import { useI18n } from '../lib/use-i18n'
import { useEditorStore } from '../store/editor-store'
import { CloseIcon } from './icons'
import { ImageStage } from './image-stage'

export function Preview() {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const closeFullscreen = useCallback(() => setIsFullscreen(false), [])
  const source = useEditorStore((state) => state.source)
  const result = useEditorStore((state) => state.result)
  const caption = useSavingsCaption()

  if (!source) return null

  return (
    <section className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center px-5 py-4 md:px-10">
      <div className="pointer-events-none absolute top-16 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-accent/20 blur-3xl" />
      <div className="relative z-10 max-w-full">
        <ImageStage
          originalUrl={source.url}
          resultUrl={result?.url ?? null}
          layout="page"
          caption={caption}
          onFullscreen={() => setIsFullscreen(true)}
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
  const { t } = useI18n()

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
    <div ref={frameRef} className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-ink px-6 pt-20 pb-10">
      <button
        type="button"
        aria-label={t('close')}
        onClick={onClose}
        className="absolute top-5 right-5 grid h-11 w-11 place-items-center rounded-full bg-sunken text-cream ring-1 ring-line"
      >
        <CloseIcon />
      </button>
      <div className="flex min-h-0 flex-1 items-center justify-center pt-4">
        <ImageStage originalUrl={source.url} resultUrl={result?.url ?? null} layout="fullscreen" />
      </div>
    </div>
  )
}
