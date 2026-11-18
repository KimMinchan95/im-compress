import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cycleChoice } from '../lib/cycle-choice'
import { useI18n } from '../lib/use-i18n'
import { useEditorStore } from '../store/editor-store'
import { clampZoom, useStageStore } from '../store/stage-store'
import type { CompareMode } from '../types'
import { ExpandIcon } from './icons'

interface ImageStageProps {
  originalUrl: string
  resultUrl: string | null
  width: number
  height: number
  layout: 'page' | 'fullscreen'
  caption?: string
}

interface ZoomAnchor {
  cursorX: number
  cursorY: number
  contentX: number
  contentY: number
  zoom: number
}

const COMPARE_MODES = ['original', 'result', 'split'] as const

function contain(width: number, height: number, maxWidth: number, maxHeight: number) {
  if (width < 1 || height < 1 || maxWidth < 1 || maxHeight < 1) return { w: 0, h: 0 }
  const scale = Math.min(maxWidth / width, maxHeight / height)
  return { w: Math.max(1, width * scale), h: Math.max(1, height * scale) }
}

function wheelPixels(event: WheelEvent) {
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1
  const dominant = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX
  return dominant * unit
}

function isTypingTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && target.closest('input, textarea, [contenteditable="true"]') !== null
}

export function ImageStage({ originalUrl, resultUrl, width, height, layout, caption }: ImageStageProps) {
  const { t } = useI18n()
  const compareMode = useEditorStore((state) => state.compareMode)
  const setCompareMode = useEditorStore((state) => state.setCompareMode)
  const zoom = useStageStore((state) => state.zoom)
  const split = useStageStore((state) => state.split)
  const setZoom = useStageStore((state) => state.setZoom)
  const setSplit = useStageStore((state) => state.setSplit)
  const openFullscreen = useStageStore((state) => state.openFullscreen)
  const frameRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const originalRef = useRef<HTMLImageElement>(null)
  const anchorRef = useRef<ZoomAnchor | null>(null)
  const spaceRef = useRef(false)
  const panRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  const movedRef = useRef(false)
  const splitCentered = useRef(false)
  const [bounds, setBounds] = useState({ w: 0, h: 0 })
  const mode: CompareMode = resultUrl ? compareMode : 'original'

  useEffect(() => {
    const node = viewportRef.current
    if (!node) return
    const measure = () => {
      const rect = node.getBoundingClientRect()
      const next = { w: Math.floor(rect.width), h: Math.floor(rect.height) }
      setBounds((prev) => (prev.w === next.w && prev.h === next.h ? prev : next))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [layout])

  useEffect(() => {
    const node = shellRef.current
    const viewport = viewportRef.current
    if (!node || !viewport) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const frame = frameRef.current
      const current = useStageStore.getState().zoom
      const next = clampZoom(current * Math.exp(-wheelPixels(event) * 0.0016))
      if (frame) {
        const viewportRect = viewport.getBoundingClientRect()
        const frameRect = frame.getBoundingClientRect()
        anchorRef.current = {
          cursorX: event.clientX - viewportRect.left,
          cursorY: event.clientY - viewportRect.top,
          contentX: (event.clientX - frameRect.left) / current,
          contentY: (event.clientY - frameRect.top) / current,
          zoom: next,
        }
      }
      setZoom(next)
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [layout, setZoom])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || isTypingTarget(event.target)) return
      spaceRef.current = true
      event.preventDefault()
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return
      spaceRef.current = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  const fitted = contain(width, height, Math.max(bounds.w - 8, 0), Math.max(bounds.h - 8, 0))
  const shownW = fitted.w * zoom
  const shownH = fitted.h * zoom

  useLayoutEffect(() => {
    const anchor = anchorRef.current
    const viewport = viewportRef.current
    const frame = frameRef.current
    if (!anchor || !viewport || !frame || anchor.zoom !== zoom) return
    const frameRect = frame.getBoundingClientRect()
    const viewportRect = viewport.getBoundingClientRect()
    viewport.scrollLeft += frameRect.left + anchor.contentX * zoom - (viewportRect.left + anchor.cursorX)
    viewport.scrollTop += frameRect.top + anchor.contentY * zoom - (viewportRect.top + anchor.cursorY)
    anchorRef.current = null
  }, [shownH, shownW, zoom])

  const moveSplit = (clientX: number) => {
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    const next = ((clientX - rect.left) / rect.width) * 100
    setSplit(next)
  }

  const syncClip = () => {
    const image = originalRef.current
    const viewport = viewportRef.current
    const frame = frameRef.current
    if (!image || !viewport || !frame || mode !== 'split') {
      if (image) image.style.clipPath = ''
      return
    }
    const view = viewport.getBoundingClientRect()
    const box = frame.getBoundingClientRect()
    if (view.width < 1 || box.width < 1) return
    const screenX = view.left + (useStageStore.getState().split / 100) * view.width
    const right = ((box.right - screenX) / box.width) * 100
    image.style.clipPath = `inset(0 ${right}% 0 0)`
  }

  const centerSplit = () => {
    const viewport = viewportRef.current
    const frame = frameRef.current
    if (!viewport || !frame) return
    const view = viewport.getBoundingClientRect()
    const box = frame.getBoundingClientRect()
    viewport.scrollLeft += box.left + box.width / 2 - (view.left + view.width / 2)
    viewport.scrollTop += box.top + box.height / 2 - (view.top + view.height / 2)
  }

  useLayoutEffect(() => {
    if (mode !== 'split') {
      splitCentered.current = false
      return
    }
    if (splitCentered.current || shownW < 1) return
    splitCentered.current = true
    setSplit(50)
    centerSplit()
  }, [mode, setSplit, shownH, shownW])

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const frame = frameRef.current
    if (!viewport || !frame || mode !== 'split') {
      syncClip()
      return
    }
    syncClip()
    viewport.addEventListener('scroll', syncClip, { passive: true })
    const observer = new ResizeObserver(syncClip)
    observer.observe(viewport)
    observer.observe(frame)
    return () => {
      viewport.removeEventListener('scroll', syncClip)
      observer.disconnect()
    }
  }, [mode, shownH, shownW, split, zoom])

  const zoomBy = (factor: number) => {
    const viewport = viewportRef.current
    const frame = frameRef.current
    const current = useStageStore.getState().zoom
    const next = clampZoom(current * factor)
    if (viewport && frame) {
      const viewportRect = viewport.getBoundingClientRect()
      const frameRect = frame.getBoundingClientRect()
      anchorRef.current = {
        cursorX: viewportRect.width / 2,
        cursorY: viewportRect.height / 2,
        contentX: (viewportRect.left + viewportRect.width / 2 - frameRect.left) / current,
        contentY: (viewportRect.top + viewportRect.height / 2 - frameRect.top) / current,
        zoom: next,
      }
    }
    setZoom(next)
  }

  const pickMode = (next: CompareMode) => {
    if (!resultUrl) return
    setCompareMode(cycleChoice(mode, next, COMPARE_MODES))
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-full bg-sunken p-1 ring-1 ring-line" role="group" aria-label={t('split')}>
          <ModeButton pressed={mode === 'original'} onClick={() => pickMode('original')}>
            {t('original')}
          </ModeButton>
          <ModeButton pressed={mode === 'result'} disabled={!resultUrl} onClick={() => pickMode('result')}>
            {t('compressed')}
          </ModeButton>
          <ModeButton pressed={mode === 'split'} disabled={!resultUrl} onClick={() => pickMode('split')}>
            {t('split')}
          </ModeButton>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full bg-sunken p-1 ring-1 ring-line">
            <ToolButton label={t('zoomOut')} disabled={zoom <= 0.25} onClick={() => zoomBy(1 / 1.2)}>
              −
            </ToolButton>
            <span className="w-12 text-center text-xs font-semibold tabular-nums">{Math.round(zoom * 100)}%</span>
            <ToolButton label={t('zoomIn')} disabled={zoom >= 8} onClick={() => zoomBy(1.2)}>
              +
            </ToolButton>
          </div>
          {layout === 'page' ? (
            <button
              type="button"
              aria-label={t('fullscreen')}
              onClick={openFullscreen}
              className="grid h-10 w-10 cursor-pointer place-items-center rounded-full bg-sunken text-cream ring-1 ring-line transition duration-200 hover:scale-105 active:scale-95"
            >
              <ExpandIcon />
            </button>
          ) : null}
        </div>
      </div>

      <div ref={shellRef} className="relative min-h-0 w-full flex-1">
      <div ref={viewportRef} className="absolute inset-0 overflow-auto overscroll-contain">
        {shownW > 0 ? (
          <div className="flex min-h-full min-w-full items-center justify-center">
            <div
              ref={frameRef}
              className={`checker relative shrink-0 overflow-hidden ring-1 ring-line select-none ${
                mode === 'split' || zoom > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
              }`}
              style={{ width: shownW, height: shownH }}
              onClick={() => {
                if (movedRef.current) {
                  movedRef.current = false
                  return
                }
                if (mode === 'split' || !resultUrl) return
                setCompareMode(mode === 'original' ? 'result' : 'original')
              }}
              onPointerDown={(event) => {
                if ((event.target as HTMLElement).closest('[data-slider]')) return
                if (event.button !== 0 && event.button !== 1) return
                const panning = event.button === 1 || spaceRef.current || mode === 'split' || zoom > 1
                if (!panning) return
                const viewport = viewportRef.current
                if (!viewport) return
                movedRef.current = false
                panRef.current = {
                  x: event.clientX,
                  y: event.clientY,
                  left: viewport.scrollLeft,
                  top: viewport.scrollTop,
                }
                event.currentTarget.setPointerCapture(event.pointerId)
              }}
              onPointerMove={(event) => {
                if (!panRef.current || !viewportRef.current) return
                const dx = event.clientX - panRef.current.x
                const dy = event.clientY - panRef.current.y
                if (Math.hypot(dx, dy) > 4) movedRef.current = true
                viewportRef.current.scrollLeft = panRef.current.left - dx
                viewportRef.current.scrollTop = panRef.current.top - dy
              }}
              onPointerUp={() => {
                panRef.current = null
              }}
            >
              {resultUrl ? (
                <img
                  src={resultUrl}
                  alt={mode === 'result' ? t('altCompressed') : ''}
                  draggable={false}
                  className={`pointer-events-none absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ${
                    mode === 'original' ? 'opacity-0' : 'opacity-100'
                  }`}
                />
              ) : null}
              <img
                ref={originalRef}
                src={originalUrl}
                alt={mode === 'result' ? '' : t('altOriginal')}
                draggable={false}
                className={`pointer-events-none absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ${
                  mode === 'result' ? 'opacity-0' : 'opacity-100'
                }`}
              />
            </div>
          </div>
        ) : null}
      </div>
      {mode === 'split' ? (
        <div
          data-slider=""
          role="slider"
          tabIndex={0}
          aria-label={t('splitPosition')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(split)}
          aria-valuetext={`${Math.round(split)}%`}
          className="absolute inset-y-0 z-30 w-3 -translate-x-1/2 cursor-ew-resize touch-none outline-none"
          style={{ left: `${split}%` }}
          onPointerDown={(event) => {
            event.stopPropagation()
            event.currentTarget.setPointerCapture(event.pointerId)
            moveSplit(event.clientX)
          }}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
            moveSplit(event.clientX)
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') {
              event.preventDefault()
              setSplit(split - 2)
            }
            if (event.key === 'ArrowRight') {
              event.preventDefault()
              setSplit(split + 2)
            }
          }}
        >
          <span className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.25)]" />
          <span className="pointer-events-none absolute top-1/2 left-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.45),0_2px_6px_rgba(0,0,0,0.35)]" />
          <span
            className={`pointer-events-none absolute z-20 whitespace-nowrap rounded-full bg-[#100f0d]/75 px-2.5 py-1 text-xs font-medium text-[#f6f1e7] ${
              split < 16 ? 'top-2 left-full ml-2' : 'top-2 right-full mr-2'
            }`}
          >
            {t('original')}
          </span>
          <span
            className={`pointer-events-none absolute z-20 whitespace-nowrap rounded-full bg-[#100f0d]/75 px-2.5 py-1 text-xs font-medium text-[#f6f1e7] ${
              split > 84 ? 'top-9 right-full mr-2' : split < 16 ? 'top-9 left-full ml-2' : 'top-2 left-full ml-2'
            }`}
          >
            {t('compressed')}
          </span>
        </div>
      ) : null}
      </div>

      {caption ? <p className="truncate text-center text-sm font-medium text-muted">{caption}</p> : null}
    </div>
  )
}

function ModeButton({
  pressed,
  disabled,
  onClick,
  children,
}: {
  pressed: boolean
  disabled?: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={`h-9 cursor-pointer rounded-full px-3 text-sm font-semibold transition duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
        pressed ? 'bg-cream text-ink' : 'text-muted hover:text-cream'
      }`}
    >
      {children}
    </button>
  )
}

function ToolButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-base font-semibold transition duration-200 hover:bg-cream/10 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  )
}
