import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatBytes, savingsOf } from '../lib/format-bytes'
import { isResultCurrent } from '../lib/files'
import { useI18n } from '../lib/use-i18n'
import { useEditorStore } from '../store/editor-store'
import { usePreferences } from '../store/preferences-store'
import { ImageStage } from './image-stage'

export function Preview() {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const closeFullscreen = useCallback(() => setIsFullscreen(false), [])

  return (
    <section className="relative flex min-h-[70vh] min-w-0 flex-1 flex-col px-5 pt-2 pb-8 md:min-h-0 md:px-10">
      <div className="pointer-events-none absolute top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-accent/20 blur-3xl" />
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5">
        <Stage layout="page" onFullscreen={() => setIsFullscreen(true)} />
        <Stats />
      </div>
      {isFullscreen ? createPortal(<Fullscreen onClose={closeFullscreen} />, document.body) : null}
    </section>
  )
}

function Stage({
  layout,
  onFullscreen,
  onClose,
}: {
  layout: 'page' | 'fullscreen'
  onFullscreen?: () => void
  onClose?: () => void
}) {
  const source = useEditorStore((state) => state.source)
  const result = useEditorStore((state) => state.result)
  const view = useEditorStore((state) => state.view)
  const toggleView = useEditorStore((state) => state.toggleView)
  const splitView = usePreferences((state) => state.splitView)
  if (!source) return null

  return (
    <>
      <ImageStage
        originalUrl={source.url}
        resultUrl={result?.url ?? null}
        showOriginal={view === 'original' || !result}
        split={splitView}
        layout={layout}
        onToggle={toggleView}
      />
      <CompareControls onFullscreen={onFullscreen} onClose={onClose} />
    </>
  )
}

function CompareControls({ onFullscreen, onClose }: { onFullscreen?: () => void; onClose?: () => void }) {
  const { t } = useI18n()
  const view = useEditorStore((state) => state.view)
  const toggleView = useEditorStore((state) => state.toggleView)
  const splitView = usePreferences((state) => state.splitView)
  const setSplitView = usePreferences((state) => state.setSplitView)
  const showingResult = view === 'result'

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={splitView}
          onClick={() => setSplitView(!splitView)}
          className={`h-12 rounded-full px-5 text-sm font-semibold transition ${
            splitView ? 'bg-cream text-ink' : 'bg-sunken text-cream ring-1 ring-line'
          }`}
        >
          {t('split')}
        </button>
        {onFullscreen ? (
          <button
            type="button"
            onClick={onFullscreen}
            className="h-12 rounded-full bg-sunken px-5 text-sm font-semibold ring-1 ring-line"
          >
            {t('fullscreen')}
          </button>
        ) : null}
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="h-12 rounded-full bg-cream px-5 text-sm font-semibold text-ink"
          >
            {t('close')}
          </button>
        ) : null}
      </div>
      {splitView ? null : (
        <button
          type="button"
          role="switch"
          aria-checked={showingResult}
          onClick={toggleView}
          className="relative grid h-14 w-full grid-cols-2 items-center rounded-full bg-sunken p-1 text-sm font-semibold ring-1 ring-line"
        >
          <span
            className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full bg-cream transition-transform ${
              showingResult ? 'translate-x-full' : 'translate-x-0'
            }`}
            style={{ left: 4 }}
          />
          <span className={`relative z-10 ${showingResult ? 'text-muted' : 'text-ink'}`}>{t('original')}</span>
          <span className={`relative z-10 ${showingResult ? 'text-ink' : 'text-muted'}`}>{t('compressed')}</span>
        </button>
      )}
    </div>
  )
}

function Stats() {
  const { t } = useI18n()
  const source = useEditorStore((state) => state.source)
  const result = useEditorStore((state) => state.result)
  const status = useEditorStore((state) => state.status)
  const width = useEditorStore((state) => state.width)
  const height = useEditorStore((state) => state.height)
  const format = useEditorStore((state) => state.format)
  const quality = useEditorStore((state) => state.quality)
  const splitView = usePreferences((state) => state.splitView)
  if (!source) return null

  const isCurrent = result ? isResultCurrent(result, { format, width, height, quality }) : false
  const savings = result ? savingsOf(source.bytes, result.bytes) : null
  const shrunk = Boolean(isCurrent && savings?.kind === 'smaller')
  const headline = !savings
    ? t('working')
    : savings.kind === 'smaller'
      ? t('smaller')(savings.percent)
      : savings.kind === 'larger'
        ? t('larger')(savings.percent)
        : t('sameSize')

  return (
    <div aria-live="polite" className="text-center">
      <p className={`text-4xl font-semibold tracking-tight ${shrunk ? 'text-accent' : 'text-cream'}`}>{headline}</p>
      <p className="mt-2 text-sm text-muted tabular-nums">
        {formatBytes(source.bytes)}
        <span className="px-2">→</span>
        {isCurrent && result ? formatBytes(result.bytes) : t('calculating')}
        <span className="px-2">·</span>
        {source.width}×{source.height}
        <span className="px-2">→</span>
        {width}×{height}
      </p>
      <p className="mt-2 text-sm text-muted">
        {status === 'encoding' ? t('encodingHint') : splitView ? t('splitHint') : t('compareHint')}
      </p>
    </div>
  )
}

function Fullscreen({ onClose }: { onClose: () => void }) {
  const frameRef = useRef<HTMLDivElement>(null)

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

  return (
    <div ref={frameRef} className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-6 overflow-auto bg-ink px-5 py-6">
      <Stage layout="fullscreen" onClose={onClose} />
      <Stats />
    </div>
  )
}
