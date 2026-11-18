import { useRef, useState } from 'react'
import { useI18n } from '../lib/use-i18n'
import { ExpandIcon } from './icons'

interface ImageStageProps {
  originalUrl: string
  resultUrl: string | null
  layout: 'page' | 'fullscreen'
  caption?: string
  onFullscreen?: () => void
}

export function ImageStage({ originalUrl, resultUrl, layout, caption, onFullscreen }: ImageStageProps) {
  const { t } = useI18n()
  const frameRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState(50)
  const photoClass =
    layout === 'fullscreen'
      ? 'checker col-start-1 row-start-1 max-h-[calc(100dvh-8rem)] max-w-full object-contain'
      : 'checker col-start-1 row-start-1 max-h-[58vh] max-w-full object-contain md:max-h-[calc(100dvh-8.5rem)]'

  const move = (clientX: number) => {
    const rect = frameRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    const next = ((clientX - rect.left) / rect.width) * 100
    setPosition(Math.min(94, Math.max(6, next)))
  }

  if (!resultUrl) {
    return (
      <div className="relative max-w-full">
        <img src={originalUrl} alt={t('altOriginal')} draggable={false} className={`${photoClass} rounded-[28px] ring-1 ring-line`} />
        {caption ? <Caption>{caption}</Caption> : null}
        {onFullscreen ? <FullscreenButton label={t('fullscreen')} onClick={onFullscreen} /> : null}
      </div>
    )
  }

  return (
    <div
      ref={frameRef}
      className="relative w-fit max-w-full cursor-ew-resize touch-none"
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest('[data-stage-control]')) return
        event.currentTarget.setPointerCapture(event.pointerId)
        move(event.clientX)
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
        move(event.clientX)
      }}
    >
      <div className="grid overflow-hidden rounded-[28px] ring-1 ring-line">
        <img src={resultUrl} alt="" draggable={false} className={photoClass} />
        <img
          src={originalUrl}
          alt=""
          draggable={false}
          className={photoClass}
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        />
      </div>
      <div className="pointer-events-none absolute inset-y-0 z-10 w-px -translate-x-1/2 bg-cream" style={{ left: `${position}%` }} />
      <button
        type="button"
        role="slider"
        aria-label={t('splitPosition')}
        aria-valuemin={6}
        aria-valuemax={94}
        aria-valuenow={Math.round(position)}
        aria-valuetext={`${Math.round(position)}%`}
        className="absolute top-1/2 z-20 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/40 bg-cream text-ink shadow-lg"
        style={{ left: `${position}%` }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') {
            event.preventDefault()
            setPosition((value) => Math.max(6, value - 2))
          }
          if (event.key === 'ArrowRight') {
            event.preventDefault()
            setPosition((value) => Math.min(94, value + 2))
          }
        }}
      >
        <span className="flex gap-1" aria-hidden="true">
          <span className="h-4 w-0.5 rounded-full bg-ink" />
          <span className="h-4 w-0.5 rounded-full bg-ink" />
        </span>
      </button>
      <span className="pointer-events-none absolute top-3 left-3 z-20 rounded-full bg-ink/75 px-3 py-1 text-xs font-medium text-cream">
        {t('original')}
      </span>
      <span
        className={`pointer-events-none absolute top-3 z-20 rounded-full bg-ink/75 px-3 py-1 text-xs font-medium text-cream ${onFullscreen ? 'right-14' : 'right-3'}`}
      >
        {t('compressed')}
      </span>
      {caption ? <Caption>{caption}</Caption> : null}
      {onFullscreen ? <FullscreenButton label={t('fullscreen')} onClick={onFullscreen} /> : null}
    </div>
  )
}

function Caption({ children }: { children: string }) {
  return (
    <p className="pointer-events-none absolute bottom-3 left-1/2 z-20 max-w-[90%] -translate-x-1/2 truncate rounded-full bg-ink/80 px-4 py-2 text-sm font-medium text-cream">
      {children}
    </p>
  )
}

function FullscreenButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      data-stage-control=""
      className="absolute top-3 right-3 z-20 grid h-10 w-10 place-items-center rounded-full bg-ink/75 text-cream"
    >
      <ExpandIcon />
    </button>
  )
}
