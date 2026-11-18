import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { sizeFromWidth } from '../lib/aspect'
import { cycleChoice } from '../lib/cycle-choice'
import { FORMAT_META, FORMATS, QUALITY_PRESETS, downloadName, isResultCurrent } from '../lib/files'
import { useI18n } from '../lib/use-i18n'
import { useEditorStore } from '../store/editor-store'
import { usePresets } from '../store/preset-store'
import { errorText } from './drop-zone'
import { ChevronIcon } from './icons'
import { NumberField } from './number-field'

const QUALITY_VALUES = QUALITY_PRESETS.map((preset) => preset.value)

export function Controls() {
  const { t } = useI18n()
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
  const setTargetBytes = useEditorStore((state) => state.setTargetBytes)
  const resetSize = useEditorStore((state) => state.resetSize)
  const retry = useEditorStore((state) => state.retry)
  const sourceName = source?.name ?? ''
  const [byteUnit, setByteUnit] = useState<'kb' | 'mb'>('kb')
  const [downloadStem, setDownloadStem] = useState('')

  useEffect(() => {
    setDownloadStem('')
  }, [sourceName])

  if (!source) return null

  const canDownload = Boolean(
    result && status === 'idle' && isResultCurrent(result, { format, width, height, quality }),
  )
  const fitted = sizeFromWidth(source.width, source.height, source.width)
  const isOriginalSize = width === fitted.width && height === fitted.height
  const outputBytes = result?.bytes ?? source.bytes
  const shownBytes = targetBytes ?? outputBytes
  const unitBytes = byteUnit === 'mb' ? 1024 * 1024 : 1024
  const bytesField =
    byteUnit === 'mb' ? Math.round((shownBytes / unitBytes) * 1000) / 1000 : Math.max(1, Math.round(shownBytes / unitBytes))

  return (
    <aside className="flex min-h-0 w-full flex-1 flex-col overflow-hidden border-t border-line bg-panel md:h-full md:w-[420px] md:flex-none md:border-t-0 md:border-l">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 md:py-5">
      <PresetSection />

      <ControlCard title={t('format')} delay={70}>
        <div className="grid grid-cols-3 gap-2">
          {FORMATS.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={format === item}
              onClick={() => setFormat(cycleChoice(format, item, FORMATS))}
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
        delay={140}
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
                  onClick={() => setQuality(cycleChoice(quality, preset.value, QUALITY_VALUES))}
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
        delay={210}
        extra={
          <button
            type="button"
            onClick={resetSize}
            disabled={isOriginalSize}
            className="h-8 cursor-pointer rounded-full px-2 text-sm text-muted transition hover:text-cream disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t('resetSize')}
          </button>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <NumberField
                label={t('bytes')}
                value={bytesField}
                decimals={byteUnit === 'mb' ? 3 : 0}
                live={false}
                onChange={(value) => {
                  const bytes = Math.round(value * unitBytes)
                  const tolerance = byteUnit === 'mb' ? 512 : 1024
                  if (value <= 0 || bytes < 1) {
                    setTargetBytes(null)
                    return
                  }
                  if (targetBytes != null && Math.abs(bytes - targetBytes) <= tolerance) return
                  if (targetBytes == null && Math.abs(bytes - outputBytes) <= tolerance) return
                  setTargetBytes(bytes)
                }}
              />
            </div>
            <div className="flex h-12 shrink-0 rounded-2xl bg-panel p-1 ring-1 ring-line">
              <button
                type="button"
                aria-pressed={byteUnit === 'kb'}
                onClick={() => setByteUnit('kb')}
                className={`cursor-pointer rounded-xl px-3 text-sm font-semibold transition duration-200 ${
                  byteUnit === 'kb' ? 'bg-cream text-ink' : 'text-muted hover:text-cream'
                }`}
              >
                KB
              </button>
              <button
                type="button"
                aria-pressed={byteUnit === 'mb'}
                onClick={() => setByteUnit('mb')}
                className={`cursor-pointer rounded-xl px-3 text-sm font-semibold transition duration-200 ${
                  byteUnit === 'mb' ? 'bg-cream text-ink' : 'text-muted hover:text-cream'
                }`}
              >
                MB
              </button>
            </div>
          </div>
          <p className="text-sm text-muted">{t('targetHint')}</p>
          <div className="grid grid-cols-3 gap-2">
            <NumberField label={t('width')} value={width} suffix="px" onChange={setWidth} />
            <NumberField label={t('height')} value={height} suffix="px" onChange={setHeight} />
            <NumberField label={t('scale')} value={scale} suffix="%" allowDecimal onChange={setScale} />
          </div>
        </div>
      </ControlCard>

      <ControlCard title={t('fileName')} delay={280}>
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
      </div>

      <div className="flex shrink-0 flex-col gap-3 border-t border-line bg-panel px-5 py-4">
        {error ? <p className="text-sm text-accent">{errorText(t, error)}</p> : null}
        {status === 'error' ? (
          <button type="button" onClick={retry} className="h-11 cursor-pointer rounded-full border border-line text-sm font-medium">
            {t('retry')}
          </button>
        ) : null}
        <button
          type="button"
          disabled={!canDownload}
          onClick={() => {
            if (!result) return
            const typed = downloadStem.trim()
            const anchor = document.createElement('a')
            anchor.href = result.url
            anchor.download = downloadName(typed || source.name, result.format)
            anchor.click()
          }}
          className={`h-12 cursor-pointer rounded-full bg-accent text-base font-semibold text-on-accent transition duration-200 hover:-translate-y-0.5 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${
            status === 'encoding' ? 'cursor-wait' : 'disabled:cursor-not-allowed'
          }`}
        >
          {status === 'encoding' ? t('encoding') : t('download')}
        </button>
      </div>
    </aside>
  )
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
      className="enter flex flex-col gap-3 rounded-3xl bg-sunken p-4 ring-1 ring-line"
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

function fileStem(fileName: string) {
  const stem = fileName.replace(/\.[^.]+$/, '').trim()
  return stem || fileName
}

function PresetSection() {
  const { t } = useI18n()
  const source = useEditorStore((state) => state.source)
  const format = useEditorStore((state) => state.format)
  const quality = useEditorStore((state) => state.quality)
  const scale = useEditorStore((state) => state.scale)
  const setFormat = useEditorStore((state) => state.setFormat)
  const setQuality = useEditorStore((state) => state.setQuality)
  const setScale = useEditorStore((state) => state.setScale)
  const presets = usePresets((state) => state.presets)
  const savePreset = usePresets((state) => state.savePreset)
  const removePreset = usePresets((state) => state.removePreset)
  const [name, setName] = useState(() => (source ? fileStem(source.name) : ''))
  const [isOpen, setIsOpen] = useState(false)
  const [notice, setNotice] = useState<'saved' | 'limit' | null>(null)

  useEffect(() => {
    if (!source) return
    setName(fileStem(source.name))
  }, [source])

  const onSave = (event: FormEvent) => {
    event.preventDefault()
    const result = savePreset({ name, format, quality, scale })
    setNotice(result)
    if (result === 'saved') {
      setIsOpen(true)
      if (source) setName(fileStem(source.name))
    }
  }

  return (
    <section className="enter overflow-hidden rounded-3xl bg-sunken ring-1 ring-line">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-4 text-left"
      >
        <span className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <span className="h-4 w-1 rounded-full bg-accent" />
          {t('saved')}
          {presets.length > 0 ? <span className="text-sm font-medium text-muted">{presets.length}</span> : null}
        </span>
        <ChevronIcon className={`h-5 w-5 text-muted transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden" inert={isOpen ? undefined : true}>
          <div className="flex flex-col gap-3 border-t border-line px-4 py-4">
            <form className="flex items-center gap-2" onSubmit={onSave}>
              <input
                value={name}
                maxLength={40}
                aria-label={t('saved')}
                onChange={(event) => setName(event.target.value)}
                className="h-12 min-w-0 flex-1 rounded-2xl border border-line bg-panel px-3 text-base outline-none transition duration-200 focus:border-accent/70"
              />
              <button type="submit" className="h-12 shrink-0 cursor-pointer rounded-2xl bg-cream px-4 text-sm font-semibold text-ink transition active:scale-[0.97]">
                {t('save')}
              </button>
            </form>
            {notice === 'saved' ? <p className="text-sm text-muted">{t('presetSaved')}</p> : null}
            {notice === 'limit' ? <p className="text-sm text-accent">{t('presetLimit')}</p> : null}
            {presets.length === 0 ? (
              <p className="text-sm text-muted">{t('emptyPresets')}</p>
            ) : (
              <ul className="flex max-h-40 flex-col gap-2 overflow-y-auto">
                {presets.map((preset) => (
                  <li key={preset.id} className="flex items-center gap-2 rounded-2xl bg-panel px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm">{preset.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setFormat(preset.format)
                        setQuality(preset.quality)
                        setScale(preset.scale)
                      }}
                      className="h-9 cursor-pointer rounded-full bg-cream px-3 text-sm font-semibold text-ink"
                    >
                      {t('load')}
                    </button>
                    <button type="button" onClick={() => removePreset(preset.id)} className="h-9 cursor-pointer px-1 text-sm text-muted">
                      {t('remove')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
