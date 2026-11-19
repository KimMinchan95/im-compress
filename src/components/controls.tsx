import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { sizeFromWidth } from '../lib/aspect'
import { byteFieldValue, targetFromField, type ByteUnit } from '../lib/byte-field'
import { errorMessage } from '../lib/error-message'
import { FORMAT_META, FORMATS, QUALITY_PRESETS, downloadName, fileStem, isAndroid, isKakaoTalk, isResultCurrent, saveFile } from '../lib/files'
import { useI18n } from '../lib/use-i18n'
import { useEditorStore } from '../store/editor-store'
import { isSamePreset, presetName, usePresets } from '../store/preset-store'
import { ChevronIcon } from './icons'
import { NumberField } from './number-field'
import { PresetDialog } from './preset-dialog'
import { SaveImageSheet } from './save-image-sheet'

type ToastTone = 'saved' | 'limit'

export function Controls() {
  const { locale, t } = useI18n()
  const source = useEditorStore((state) => state.source)
  const format = useEditorStore((state) => state.format)
  const quality = useEditorStore((state) => state.quality)
  const width = useEditorStore((state) => state.width)
  const height = useEditorStore((state) => state.height)
  const scale = useEditorStore((state) => state.scale)
  const result = useEditorStore((state) => state.result)
  const status = useEditorStore((state) => state.status)
  const error = useEditorStore((state) => state.error)
  const setFormat = useEditorStore((state) => state.setFormat)
  const setQuality = useEditorStore((state) => state.setQuality)
  const setWidth = useEditorStore((state) => state.setWidth)
  const setHeight = useEditorStore((state) => state.setHeight)
  const setScale = useEditorStore((state) => state.setScale)
  const targetBytes = useEditorStore((state) => state.targetBytes)
  const sizeMode = useEditorStore((state) => state.sizeMode)
  const setTargetBytes = useEditorStore((state) => state.setTargetBytes)
  const setSizeMode = useEditorStore((state) => state.setSizeMode)
  const resetSize = useEditorStore((state) => state.resetSize)
  const retry = useEditorStore((state) => state.retry)
  const sourceName = source?.name ?? ''
  const presets = usePresets((state) => state.presets)
  const savePreset = usePresets((state) => state.savePreset)
  const [byteUnit, setByteUnit] = useState<ByteUnit>('kb')
  const [downloadStem, setDownloadStem] = useState('')
  const [isPresetOpen, setIsPresetOpen] = useState(false)
  const [isOpen, setIsOpen] = useState(() => window.matchMedia('(min-width: 768px)').matches)
  const [isSheet, setIsSheet] = useState(false)
  const [isImageOpen, setIsImageOpen] = useState(false)
  const [toast, setToast] = useState<{ tone: ToastTone; id: number; message?: string; long?: boolean } | null>(null)
  const closePresets = useCallback(() => setIsPresetOpen(false), [])
  const closeSheet = useCallback(() => {
    setIsSheet(false)
    setIsOpen(false)
    setIsPresetOpen(false)
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)')
    const closeOnDesktop = () => {
      if (media.matches) setIsSheet(false)
    }
    media.addEventListener('change', closeOnDesktop)
    return () => media.removeEventListener('change', closeOnDesktop)
  }, [])

  useEffect(() => {
    setDownloadStem('')
  }, [sourceName])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), toast.long ? 3200 : toast.tone === 'saved' ? 1800 : 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  if (!source) return null

  const canDownload = Boolean(
    result && status === 'idle' && isResultCurrent(result, { format, width, height, quality }),
  )
  const fitted = sizeFromWidth(source.width, source.height, source.width)
  const isOriginalSize = width === fitted.width && height === fitted.height
  const outputBytes = result?.bytes ?? source.bytes
  const shownBytes = targetBytes ?? outputBytes
  const isBytes = sizeMode === 'bytes'
  const bytesField = byteFieldValue(shownBytes, byteUnit)

  const saveCurrent = () => {
    const latest = useEditorStore.getState()
    const latestIsBytes = latest.sizeMode === 'bytes'
    const latestOutput = latest.result?.bytes ?? latest.source?.bytes ?? outputBytes
    const savedTarget = latestIsBytes ? Math.max(1, Math.round(latest.targetBytes ?? latestOutput)) : null
    if (latestIsBytes && savedTarget != null && latest.targetBytes !== savedTarget) latest.setTargetBytes(savedTarget)
    const draft = {
      format: latest.format,
      quality: latest.quality,
      scale: latest.scale,
      sizeMode: latest.sizeMode,
      targetBytes: savedTarget,
    }
    const alreadySaved = presets.some((preset) => isSamePreset(preset, draft))
    if (alreadySaved) {
      setToast({ tone: 'saved', id: Date.now() })
      return
    }
    const outcome = savePreset({
      name: presetName(format, quality),
      ...draft,
    })
    setToast({ tone: outcome, id: Date.now() })
  }

  const download = () => {
    if (!result) return
    saveResult()
  }

  const saveResult = () => {
    if (!result) return
    const typed = downloadStem.trim()
    void saveFile(result.blob, result.url, downloadName(typed || source.name, result.format), FORMAT_META[result.format].mime).then(
      (outcome) => {
        if (outcome === 'saved') {
          setToast({ tone: 'saved', id: Date.now(), message: t('imageSaved') })
          return
        }
        if (outcome === 'started' && (isKakaoTalk() || isAndroid())) {
          setToast({ tone: 'saved', id: Date.now(), message: t('downloadStarted') })
          return
        }
        if (outcome === 'failed' && !isAndroid()) setIsImageOpen(true)
      },
    )
  }

  const commitBytes = (value: number) => {
    const next = targetFromField(value, byteUnit, targetBytes, outputBytes)
    if (next !== undefined) setTargetBytes(next)
  }

  const togglePanel = () => {
    setIsPresetOpen(false)
    if (isSheet) {
      closeSheet()
      return
    }
    if (window.matchMedia('(max-width: 767px)').matches) {
      setIsOpen(true)
      setIsSheet(true)
      return
    }
    setIsOpen((open) => !open)
  }

  return (
    <aside className={panelClass(isOpen, isSheet)}>
      <div
        id="settings-panel"
        inert={!isOpen}
        aria-hidden={!isOpen}
        className={`absolute inset-0 overflow-hidden ${isOpen ? '' : 'pointer-events-none invisible'}`}
      >
        <div className="flex h-full min-h-0 w-full min-w-0 flex-col md:min-w-[420px]">
          {isSheet ? (
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
              <h2 className="text-base font-semibold">{t('adjustOptions')}</h2>
              <button
                type="button"
                onClick={closeSheet}
                className="h-10 cursor-pointer rounded-full bg-sunken px-4 text-sm font-semibold ring-1 ring-line"
              >
                {t('showImage')}
              </button>
            </div>
          ) : null}
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3 md:gap-4 md:px-5 md:py-5">
            <ControlCard title={t('fileName')} delay={70}>
              <input
                value={downloadStem}
                maxLength={120}
                spellCheck={false}
                aria-label={t('fileName')}
                placeholder={fileStem(source.name)}
                onChange={(event) => setDownloadStem(event.target.value)}
                className="h-12 rounded-2xl border border-line bg-panel px-3 text-base outline-none transition duration-200 placeholder:text-muted focus:border-accent/70"
              />
            </ControlCard>

            <ControlCard title={t('format')} delay={140}>
              <div className="grid grid-cols-3 gap-2">
                {FORMATS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={format === item}
                    onClick={() => setFormat(item)}
                    className={`h-12 cursor-pointer rounded-2xl text-base font-semibold transition duration-200 active:scale-[0.97] ${
                      format === item
                        ? 'bg-cream text-ink shadow-[0_8px_24px_rgba(0,0,0,0.12)]'
                        : 'bg-panel text-cream hover:-translate-y-0.5 hover:bg-cream/10'
                    }`}
                  >
                    {FORMAT_META[item].label}
                  </button>
                ))}
              </div>
            </ControlCard>

            <ControlCard
              title={t('quality')}
              delay={210}
              extra={
                format === 'png' ? null : (
                  <span className="text-3xl font-semibold tabular-nums leading-none">{quality}%</span>
                )
              }
            >
              {format === 'png' ? (
                <p className="rounded-2xl bg-panel px-4 py-3 text-sm text-muted">{t('pngLossless')}</p>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-2">
                    {QUALITY_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        aria-pressed={quality === preset.value}
                        onClick={() => setQuality(preset.value)}
                        className={`h-11 cursor-pointer rounded-xl text-sm font-semibold transition duration-200 active:scale-[0.97] ${
                          quality === preset.value ? 'bg-cream text-ink' : 'bg-panel text-muted hover:-translate-y-0.5 hover:text-cream'
                        }`}
                      >
                        {t(preset.id)}
                      </button>
                    ))}
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={100}
                    step={1}
                    value={quality}
                    aria-label={t('quality')}
                    aria-valuetext={`${quality}%`}
                    onChange={(event) => setQuality(Number(event.target.value))}
                    className="quality-slider mt-1"
                    style={{
                      backgroundImage: `linear-gradient(to right, var(--accent) ${quality}%, var(--line) ${quality}%)`,
                    }}
                  />
                </>
              )}
            </ControlCard>

            <ControlCard
              title={t('size')}
              delay={280}
              extra={
                isBytes ? null : (
                  <button
                    type="button"
                    onClick={resetSize}
                    disabled={isOriginalSize}
                    className="h-8 cursor-pointer rounded-full px-2 text-sm text-muted transition hover:text-cream disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {t('resetSize')}
                  </button>
                )
              }
            >
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-1 rounded-2xl bg-panel p-1 ring-1 ring-line">
                  <button
                    type="button"
                    aria-pressed={isBytes}
                    onClick={() => setSizeMode('bytes')}
                    className={`h-10 cursor-pointer rounded-xl text-sm font-semibold transition duration-200 ${
                      isBytes ? 'bg-cream text-ink' : 'text-muted hover:text-cream'
                    }`}
                  >
                    {t('bytes')}
                  </button>
                  <button
                    type="button"
                    aria-pressed={!isBytes}
                    onClick={() => setSizeMode('dimensions')}
                    className={`h-10 cursor-pointer rounded-xl text-sm font-semibold transition duration-200 ${
                      isBytes ? 'text-muted hover:text-cream' : 'bg-cream text-ink'
                    }`}
                  >
                    {t('sizeByDimensions')}
                  </button>
                </div>
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <NumberField
                      label={t('bytesAtMost')}
                      value={bytesField}
                      decimals={byteUnit === 'mb' ? 3 : 0}
                      disabled={!isBytes}
                      onChange={commitBytes}
                    />
                  </div>
                  <div className={`flex h-12 shrink-0 rounded-2xl bg-panel p-1 ring-1 ring-line ${isBytes ? '' : 'opacity-40'}`}>
                    <button
                      type="button"
                      aria-pressed={byteUnit === 'kb'}
                      disabled={!isBytes}
                      onClick={() => setByteUnit('kb')}
                      className={`cursor-pointer rounded-xl px-3 text-sm font-semibold transition duration-200 disabled:cursor-not-allowed ${
                        byteUnit === 'kb' ? 'bg-cream text-ink' : 'text-muted hover:text-cream'
                      }`}
                    >
                      KB
                    </button>
                    <button
                      type="button"
                      aria-pressed={byteUnit === 'mb'}
                      disabled={!isBytes}
                      onClick={() => setByteUnit('mb')}
                      className={`cursor-pointer rounded-xl px-3 text-sm font-semibold transition duration-200 disabled:cursor-not-allowed ${
                        byteUnit === 'mb' ? 'bg-cream text-ink' : 'text-muted hover:text-cream'
                      }`}
                    >
                      MB
                    </button>
                  </div>
                </div>
                <p className="text-sm text-muted">{isBytes ? t('targetHint') : t('dimensionHint')}</p>
                <div className="grid grid-cols-3 gap-2">
                  <NumberField label={t('width')} value={width} suffix="px" disabled={isBytes} onChange={setWidth} />
                  <NumberField label={t('height')} value={height} suffix="px" disabled={isBytes} onChange={setHeight} />
                  <NumberField label={t('scale')} value={scale} suffix="%" allowDecimal disabled={isBytes} onChange={setScale} />
                </div>
              </div>
            </ControlCard>
          </div>

          <div className="flex shrink-0 flex-col gap-2.5 border-t border-line bg-panel px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {error ? <p className="text-sm text-accent">{errorMessage(locale, error)}</p> : null}
            {status === 'error' ? (
              <button type="button" onClick={retry} className="h-10 cursor-pointer rounded-full border border-line text-sm font-medium">
                {t('retry')}
              </button>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-haspopup="dialog"
                aria-expanded={isPresetOpen}
                onClick={() => setIsPresetOpen(true)}
                className="h-10 cursor-pointer rounded-full border border-line bg-sunken text-sm font-semibold transition duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
              >
                {t('loadSettings')}
                {presets.length > 0 ? <span className="ml-1.5 text-muted">{presets.length}</span> : null}
              </button>
              <button
                type="button"
                onClick={saveCurrent}
                className="h-10 cursor-pointer rounded-full border border-line bg-sunken text-sm font-semibold transition duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
              >
                {t('saveSettings')}
              </button>
            </div>
            <button
              type="button"
              disabled={!canDownload}
              onClick={download}
              className={`h-11 cursor-pointer rounded-full bg-accent text-sm font-semibold text-on-accent transition duration-200 hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-40 ${
                status === 'encoding' ? 'cursor-wait' : 'disabled:cursor-not-allowed'
              }`}
            >
              {status === 'encoding' ? (
                t('encoding')
              ) : (
                <>
                  <span className="md:hidden">{t('convert')}</span>
                  <span className="hidden md:inline">{t('download')}</span>
                </>
              )}
            </button>
          </div>
          {isPresetOpen ? <PresetDialog onClose={closePresets} /> : null}
          {toast ? (
            <SaveToast tone={toast.tone} message={toast.message ?? (toast.tone === 'limit' ? t('presetLimit') : t('presetSaved'))} />
          ) : null}
          {isImageOpen && result ? (
            <SaveImageSheet url={result.url} onClose={() => setIsImageOpen(false)} onDownload={saveResult} />
          ) : null}
        </div>
      </div>
      {isSheet ? null : (
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls="settings-panel"
          aria-label={isOpen ? t('hideSettings') : t('adjustOptions')}
          onClick={togglePanel}
          className={
            isOpen
              ? 'absolute top-0 left-1/2 z-30 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-panel text-muted ring-1 ring-line transition duration-200 hover:scale-105 hover:text-cream active:scale-95 md:top-1/2 md:left-0'
              : 'absolute inset-0 z-20 flex cursor-pointer items-center justify-center gap-2 bg-panel text-muted transition duration-200 hover:bg-sunken hover:text-cream md:flex-col md:gap-3'
          }
        >
          <ChevronIcon
            className={`h-4 w-4 transition-transform duration-300 ${isOpen ? 'md:-rotate-90' : 'rotate-180 md:rotate-90'}`}
          />
          {isOpen ? null : <span className="text-sm font-medium md:[writing-mode:vertical-rl]">{t('adjustOptions')}</span>}
        </button>
      )}
    </aside>
  )
}

function panelClass(isOpen: boolean, isSheet: boolean) {
  if (isSheet) return 'fixed inset-0 z-40 h-dvh w-full bg-panel'
  const size = isOpen
    ? 'z-20 min-h-0 w-full flex-1 md:w-[420px] md:flex-none'
    : 'z-20 h-[calc(3.5rem+env(safe-area-inset-bottom))] w-full flex-none md:h-12 md:w-12'
  return `relative border-t border-line bg-panel transition-[width,height] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none md:h-full md:border-t-0 md:border-l ${size}`
}

function ControlCard({
  title,
  extra,
  delay,
  children,
}: {
  title: string
  extra?: ReactNode
  delay: number
  children: ReactNode
}) {
  return (
    <section
      className="enter flex flex-col gap-3 rounded-3xl bg-sunken p-3 ring-1 ring-line md:p-4"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
        <h3 className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <span className="h-4 w-1 rounded-full bg-accent" />
          {title}
        </h3>
        {extra}
      </div>
      {children}
    </section>
  )
}

function SaveToast({ tone, message }: { tone: ToastTone; message: string }) {
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
      <p
        role="status"
        className={`overlay-in rounded-full px-4 py-2.5 text-sm font-semibold shadow-[0_12px_40px_rgba(0,0,0,0.28)] ${
          tone === 'limit' ? 'bg-accent text-on-accent' : 'bg-cream text-ink'
        }`}
      >
        {message}
      </p>
    </div>,
    document.body,
  )
}
