import { useRef, useState } from 'react'
import { useI18n } from '../lib/use-i18n'

interface ImageStageProps {
  originalUrl: string
  resultUrl: string | null
  showOriginal: boolean
  split: boolean
  layout: 'page' | 'fullscreen'
  onToggle: () => void
}

export function ImageStage({
  originalUrl,
  resultUrl,
  showOriginal,
  split,
  layout,
  onToggle,
}: ImageStageProps) {
  const { t } = useI18n()
  const frameRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState(50)
  const frameClass =
    layout === 'fullscreen'
      ? 'max-h-[78vh] max-w-full object-contain'
      : 'max-h-[46vh] max-w-full object-contain md:max-h-[56vh]'
  const photoClass = `checker ${frameClass} shadow-[0_24px_70px_rgba(0,0,0,0.28)]`

  if (!split) {
    const src = showOriginal || !resultUrl ? originalUrl : resultUrl
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-label={showOriginal ? t('showCompressed') : t('showOriginal')}
        className="group max-w-full"
      >
        <img
          src={src}
          alt={showOriginal ? t('altOriginal') : t('altCompressed')}
          draggable={false}
          className={`${photoClass} rounded-[28px] ring-1 ring-line transition group-hover:ring-accent/70`}
        />
      </button>
    )
  }

  const move = (clientX: number) => {
    const rect = frameRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    const next = ((clientX - rect.left) / rect.width) * 100
    setPosition(Math.min(92, Math.max(8, next)))
  }

  return (
    <div
      ref={frameRef}
      className="relative w-fit max-w-full cursor-ew-resize touch-none"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        move(event.clientX)
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
        move(event.clientX)
      }}
    >
      <div className="grid overflow-hidden rounded-[28px] ring-1 ring-line">
        <img
          src={resultUrl ?? originalUrl}
          alt=""
          draggable={false}
          className={`${photoClass} col-start-1 row-start-1 shadow-none`}
        />
        <img
          src={originalUrl}
          alt=""
          draggable={false}
          className={`${photoClass} col-start-1 row-start-1 shadow-none`}
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        />
      </div>
      <div className="pointer-events-none absolute inset-y-3 z-10 w-0.5 -translate-x-1/2 bg-cream" style={{ left: `${position}%` }} />
      <button
        type="button"
        role="slider"
        aria-label={t('splitPosition')}
        aria-valuemin={8}
        aria-valuemax={92}
        aria-valuenow={Math.round(position)}
        aria-valuetext={`${Math.round(position)}%`}
        className="absolute top-1/2 z-20 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-line bg-cream text-ink shadow-lg"
        style={{ left: `${position}%` }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') {
            event.preventDefault()
            setPosition((value) => Math.max(8, value - 2))
          }
          if (event.key === 'ArrowRight') {
            event.preventDefault()
            setPosition((value) => Math.min(92, value + 2))
          }
        }}
      >
        <span className="flex gap-1" aria-hidden="true">
          <span className="h-4 w-0.5 rounded-full bg-ink" />
          <span className="h-4 w-0.5 rounded-full bg-ink" />
        </span>
      </button>
      <span className="pointer-events-none absolute top-3 left-3 rounded-full bg-ink/75 px-3 py-1 text-xs font-medium text-cream">
        {t('original')}
      </span>
      <span className="pointer-events-none absolute top-3 right-3 rounded-full bg-ink/75 px-3 py-1 text-xs font-medium text-cream">
        {t('compressed')}
      </span>
    </div>
  )
}
