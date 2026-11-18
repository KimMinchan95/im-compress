import { useState, type FormEvent } from 'react'
import { sizeFromWidth } from '../lib/aspect'
import { FORMAT_META, FORMATS, QUALITY_PRESETS, downloadName, isResultCurrent } from '../lib/files'
import { useI18n } from '../lib/use-i18n'
import { useEditorStore } from '../store/editor-store'
import { usePresets } from '../store/preset-store'
import { errorText } from './drop-zone'
import { NumberField } from './number-field'

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
  const resetSize = useEditorStore((state) => state.resetSize)
  const retry = useEditorStore((state) => state.retry)

  if (!source) return null

  const canDownload = Boolean(
    result && status === 'idle' && isResultCurrent(result, { format, width, height, quality }),
  )
  const fitted = sizeFromWidth(source.width, source.height, source.width)
  const isOriginalSize = width === fitted.width && height === fitted.height

  return (
    <aside className="flex w-full shrink-0 flex-col gap-8 border-t border-line bg-panel px-5 py-6 md:w-[380px] md:overflow-y-auto md:border-t-0 md:border-l md:px-6 md:py-8">
      <div>
        <p className="truncate text-sm text-muted">{source.name}</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">{t('exportTitle')}</h2>
      </div>

      <section className="flex flex-col gap-3">
        <SectionLabel>{t('format')}</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          {FORMATS.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={format === item}
              onClick={() => setFormat(item)}
              className={`h-12 rounded-2xl text-sm font-semibold transition active:scale-[0.98] ${
                format === item ? 'bg-cream text-ink' : 'bg-sunken text-cream hover:bg-cream/10'
              }`}
            >
              {FORMAT_META[item].label}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-end justify-between">
          <SectionLabel>{t('quality')}</SectionLabel>
          {format === 'png' ? null : (
            <span className="text-3xl font-semibold tabular-nums leading-none">{quality}%</span>
          )}
        </div>
        {format === 'png' ? (
          <p className="rounded-2xl bg-sunken px-4 py-4 text-sm leading-6 text-muted">{t('pngLossless')}</p>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2">
              {QUALITY_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={quality === preset.value}
                  onClick={() => setQuality(preset.value)}
                  className={`h-10 rounded-xl text-sm font-medium transition active:scale-[0.98] ${
                    quality === preset.value ? 'bg-cream text-ink' : 'bg-sunken text-muted hover:text-cream'
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
              className="quality-slider mt-2"
              style={{
                backgroundImage: `linear-gradient(to right, var(--accent) ${quality}%, var(--line) ${quality}%)`,
              }}
            />
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <SectionLabel>{t('size')}</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label={t('width')} value={width} suffix="px" onChange={setWidth} />
          <NumberField label={t('height')} value={height} suffix="px" onChange={setHeight} />
        </div>
        <NumberField label={t('scale')} value={scale} suffix="%" allowDecimal onChange={setScale} />
        <button
          type="button"
          onClick={resetSize}
          disabled={isOriginalSize}
          className="h-11 rounded-2xl border border-line text-sm font-medium transition hover:border-cream/30 disabled:cursor-default disabled:opacity-40"
        >
          {t('resetSize')}
        </button>
      </section>

      <PresetSection />

      <div className="mt-auto flex flex-col gap-3">
        {error ? <p className="text-sm text-accent">{errorText(t, error)}</p> : null}
        {status === 'error' ? (
          <button type="button" onClick={retry} className="h-11 rounded-full border border-line text-sm font-medium">
            {t('retry')}
          </button>
        ) : null}
        <button
          type="button"
          disabled={!canDownload}
          onClick={() => {
            if (!result) return
            const anchor = document.createElement('a')
            anchor.href = result.url
            anchor.download = downloadName(source.name, result.format)
            anchor.click()
          }}
          className={`h-14 rounded-full bg-accent text-base font-semibold text-on-accent transition active:scale-[0.98] disabled:opacity-40 ${
            status === 'encoding' ? 'cursor-wait' : 'disabled:cursor-not-allowed'
          }`}
        >
          {status === 'encoding' ? t('encoding') : t('download')}
        </button>
      </div>
    </aside>
  )
}

function PresetSection() {
  const { t } = useI18n()
  const format = useEditorStore((state) => state.format)
  const quality = useEditorStore((state) => state.quality)
  const scale = useEditorStore((state) => state.scale)
  const setFormat = useEditorStore((state) => state.setFormat)
  const setQuality = useEditorStore((state) => state.setQuality)
  const setScale = useEditorStore((state) => state.setScale)
  const presets = usePresets((state) => state.presets)
  const savePreset = usePresets((state) => state.savePreset)
  const removePreset = usePresets((state) => state.removePreset)
  const [name, setName] = useState('')
  const [notice, setNotice] = useState<'saved' | 'limit' | null>(null)

  const onSave = (event: FormEvent) => {
    event.preventDefault()
    const result = savePreset({ name, format, quality, scale })
    setNotice(result)
    if (result === 'saved') setName('')
  }

  return (
    <section className="flex flex-col gap-3">
      <SectionLabel>{t('saved')}</SectionLabel>
      <form className="flex gap-2" onSubmit={onSave}>
        <input
          value={name}
          maxLength={40}
          placeholder={t('presetPlaceholder')}
          aria-label={t('saved')}
          onChange={(event) => setName(event.target.value)}
          className="h-12 min-w-0 flex-1 rounded-2xl border border-line bg-sunken px-3 text-sm outline-none placeholder:text-muted"
        />
        <button type="submit" className="h-12 shrink-0 rounded-2xl bg-cream px-4 text-sm font-semibold text-ink">
          {t('save')}
        </button>
      </form>
      {notice === 'saved' ? <p className="text-sm text-muted">{t('presetSaved')}</p> : null}
      {notice === 'limit' ? <p className="text-sm text-accent">{t('presetLimit')}</p> : null}
      {presets.length === 0 ? (
        <p className="text-sm text-muted">{t('emptyPresets')}</p>
      ) : (
        <ul className="flex max-h-52 flex-col gap-2 overflow-auto">
          {presets.map((preset) => (
            <li key={preset.id} className="flex items-center gap-2 rounded-2xl bg-sunken px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm">{preset.name}</span>
              <button
                type="button"
                onClick={() => {
                  setFormat(preset.format)
                  setQuality(preset.quality)
                  setScale(preset.scale)
                }}
                className="h-9 rounded-full bg-cream px-3 text-sm font-semibold text-ink"
              >
                {t('load')}
              </button>
              <button
                type="button"
                onClick={() => removePreset(preset.id)}
                className="h-9 px-1 text-sm text-muted"
              >
                {t('remove')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function SectionLabel({ children }: { children: string }) {
  return <h3 className="text-[11px] font-medium tracking-[0.14em] text-muted">{children}</h3>
}
