import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { byteFieldValue } from '../lib/byte-field'
import { formatBytes, savingsOf } from '../lib/format-bytes'
import { FORMAT_META, FORMATS, QUALITY_PRESETS, downloadName, fileStem, isKakaoTalk, saveDownload } from '../lib/files'
import { useI18n } from '../lib/use-i18n'
import { zipInWorker } from '../lib/zip-client'
import { sameSettings, useBatchStore, type BatchItem } from '../store/batch-store'
import { isSamePreset, presetName, useBatchPresets } from '../store/preset-store'
import { ChevronIcon, CloseIcon } from './icons'
import { NumberField } from './number-field'
import { PresetDialog } from './preset-dialog'

type ByteUnit = 'kb' | 'mb'

export function BatchView() {
  const { t } = useI18n()
  const items = useBatchStore((state) => state.items)
  const settings = useBatchStore((state) => state.settings)
  const isOpening = useBatchStore((state) => state.isOpening)
  const skipped = useBatchStore((state) => state.skipped)
  const setFormat = useBatchStore((state) => state.setFormat)
  const setQuality = useBatchStore((state) => state.setQuality)
  const setScale = useBatchStore((state) => state.setScale)
  const setSizeMode = useBatchStore((state) => state.setSizeMode)
  const setTargetBytes = useBatchStore((state) => state.setTargetBytes)
  const applyShared = useBatchStore((state) => state.applyShared)
  const presets = useBatchPresets((state) => state.presets)
  const savePreset = useBatchPresets((state) => state.savePreset)
  const [toast, setToast] = useState<{ tone: 'saved' | 'limit'; id: number } | null>(null)
  const openItem = useBatchStore((state) => state.openItem)
  const retryItem = useBatchStore((state) => state.retryItem)
  const removeItem = useBatchStore((state) => state.removeItem)
  const [byteUnit, setByteUnit] = useState<ByteUnit>('kb')
  const [isPresetOpen, setIsPresetOpen] = useState(false)
  const [isZipping, setIsZipping] = useState(false)
  const [zipHint, setZipHint] = useState<string | null>(null)
  const done = items.filter((item) => isReady(item)).length
  const isBytes = settings.sizeMode === 'bytes'
  const bytesValue = settings.targetBytes == null ? 0 : byteFieldValue(settings.targetBytes, byteUnit)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), toast.tone === 'saved' ? 1800 : 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  const saveCurrent = () => {
    const latest = useBatchStore.getState().settings
    const targetBytes = latest.sizeMode === 'bytes' && latest.targetBytes != null ? Math.max(1, Math.round(latest.targetBytes)) : null
    const draft = {
      format: latest.format,
      quality: latest.quality,
      scale: latest.scale,
      sizeMode: latest.sizeMode,
      targetBytes,
    }
    const alreadySaved = useBatchPresets.getState().presets.some((preset) => isSamePreset(preset, draft))
    if (alreadySaved) {
      setToast({ tone: 'saved', id: Date.now() })
      return
    }
    setToast({ tone: savePreset({ name: presetName(latest.format, latest.quality), ...draft }), id: Date.now() })
  }

  const downloadZip = async () => {
    const ready = items.filter(isReady)
    if (ready.length === 0 || isZipping) return
    setIsZipping(true)
    setZipHint(null)
    try {
      const names = uniqueNames(ready.map((item) => downloadName(item.name, item.result!.format)))
      const blob = await zipInWorker(ready.map((item, index) => ({ name: names[index], blob: item.result!.blob })))
      const outcome = await saveDownload(blob, t('batchZipName'))
      if (outcome === 'failed') setZipHint(isKakaoTalk() ? t('kakaoDownload') : t('downloadRetry'))
    } catch {
      setZipHint(t('downloadRetry'))
    } finally {
      setIsZipping(false)
    }
  }

  if (isOpening && items.length === 0) {
    return (
      <main className="grid min-h-0 flex-1 place-items-center px-6 text-center">
        <p className="text-lg font-semibold">{t('dropReading')}</p>
      </main>
    )
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2 md:px-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 pb-4">
          <div>
            <p className="text-sm font-semibold text-accent" aria-live="polite">
              {t('batchProgress')(done, items.length)}
            </p>
            <p className="mt-1 text-sm text-muted">{t('batchHint')}</p>
            {skipped > 0 ? <p className="mt-1 text-sm text-accent">{t('batchSkipped')(skipped)}</p> : null}
          </div>

          <section className="flex flex-col gap-4 rounded-3xl bg-sunken p-3 ring-1 ring-line md:p-4">
            <h2 className="text-base font-semibold">{t('settings')}</h2>
            <div className="grid grid-cols-3 gap-2">
              {FORMATS.map((format) => (
                <button
                  key={format}
                  type="button"
                  aria-pressed={settings.format === format}
                  onClick={() => setFormat(format)}
                  className={`h-11 cursor-pointer rounded-2xl text-sm font-semibold transition duration-200 active:scale-[0.97] ${
                    settings.format === format ? 'bg-cream text-ink' : 'bg-panel text-cream hover:bg-cream/10'
                  }`}
                >
                  {FORMAT_META[format].label}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{t('quality')}</h3>
                <span className="text-2xl font-semibold tabular-nums">{settings.quality}%</span>
              </div>
              {settings.format === 'png' ? <p className="text-sm text-muted">{t('pngHint')}</p> : null}
                <div className="grid grid-cols-5 gap-2">
                  {QUALITY_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      aria-pressed={settings.quality === preset.value}
                      onClick={() => setQuality(preset.value)}
                      className={`h-10 cursor-pointer rounded-xl text-sm font-semibold transition duration-200 active:scale-[0.97] ${
                        settings.quality === preset.value ? 'bg-cream text-ink' : 'bg-panel text-muted hover:text-cream'
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
                  value={settings.quality}
                  aria-label={t('quality')}
                  aria-valuetext={`${settings.quality}%`}
                  onChange={(event) => setQuality(Number(event.target.value))}
                  className="quality-slider"
                  style={{
                    backgroundImage: `linear-gradient(to right, var(--accent) ${settings.quality}%, var(--line) ${settings.quality}%)`,
                  }}
                />
            </div>
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
            {isBytes ? (
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <NumberField
                    label={t('bytesAtMost')}
                    value={bytesValue}
                    decimals={byteUnit === 'mb' ? 3 : 0}
                    blankZero
                    onChange={(value) => {
                      const unit = byteUnit === 'mb' ? 1024 * 1024 : 1024
                      setTargetBytes(value < 1 ? null : Math.round(value * unit))
                    }}
                  />
                </div>
                <div className="flex h-12 shrink-0 rounded-2xl bg-panel p-1 ring-1 ring-line">
                  <UnitButton pressed={byteUnit === 'kb'} onClick={() => setByteUnit('kb')}>
                    KB
                  </UnitButton>
                  <UnitButton pressed={byteUnit === 'mb'} onClick={() => setByteUnit('mb')}>
                    MB
                  </UnitButton>
                </div>
              </div>
            ) : (
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <NumberField label={t('scale')} value={settings.scale} suffix="%" allowDecimal onChange={setScale} />
                </div>
                <button
                  type="button"
                  onClick={() => setScale(100)}
                  disabled={settings.scale === 100}
                  className="h-12 cursor-pointer rounded-2xl bg-panel px-3 text-sm font-semibold text-muted ring-1 ring-line disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t('resetSize')}
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-haspopup="dialog"
                aria-expanded={isPresetOpen}
                onClick={() => setIsPresetOpen(true)}
                className="h-10 cursor-pointer rounded-full border border-line bg-panel text-sm font-semibold transition duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
              >
                {t('loadSettings')}
                {presets.length > 0 ? <span className="ml-1.5 text-muted">{presets.length}</span> : null}
              </button>
              <button
                type="button"
                onClick={saveCurrent}
                className="h-10 cursor-pointer rounded-full border border-line bg-panel text-sm font-semibold transition duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
              >
                {t('saveSettings')}
              </button>
            </div>
          </section>

          <BatchReel items={items} onOpen={openItem} onRetry={retryItem} onRemove={removeItem} />
        </div>
      </div>
      <div className="shrink-0 border-t border-line bg-panel px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-2">
          {zipHint ? <p className="text-sm text-accent">{zipHint}</p> : null}
          <button
            type="button"
            disabled={done === 0 || isZipping}
            onClick={() => void downloadZip()}
            className="h-11 cursor-pointer rounded-full bg-accent text-sm font-semibold text-on-accent transition duration-200 hover:-translate-y-0.5 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isZipping ? t('batchZipWait') : t('batchZip')}
          </button>
        </div>
      </div>
      {isPresetOpen ? (
        <PresetDialog
          list="batch"
          onClose={() => setIsPresetOpen(false)}
          onApply={(preset) =>
            applyShared({
              format: preset.format,
              quality: preset.quality,
              scale: preset.scale,
              sizeMode: preset.sizeMode,
              targetBytes: preset.sizeMode === 'bytes' ? preset.targetBytes : null,
            })
          }
        />
      ) : null}
      {toast
        ? createPortal(
            <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
              <p
                role="status"
                className={`overlay-in rounded-full px-4 py-2.5 text-sm font-semibold shadow-[0_12px_40px_rgba(0,0,0,0.28)] ${
                  toast.tone === 'limit' ? 'bg-accent text-on-accent' : 'bg-cream text-ink'
                }`}
              >
                {toast.tone === 'limit' ? t('presetLimit') : t('presetSaved')}
              </p>
            </div>,
            document.body,
          )
        : null}
    </main>
  )
}

function BatchReel({
  items,
  onOpen,
  onRetry,
  onRemove,
}: {
  items: BatchItem[]
  onOpen: (id: string) => void
  onRetry: (id: string) => void
  onRemove: (id: string) => void
}) {
  const { t } = useI18n()
  const perPage = usePageSize()
  const [index, setIndex] = useState(0)
  const pageCount = Math.max(1, Math.ceil(items.length / perPage))
  const page = Math.min(index, pageCount - 1)
  const start = page * perPage

  useEffect(() => {
    setIndex((current) => Math.min(current, Math.max(0, Math.ceil(items.length / perPage) - 1)))
  }, [items.length, perPage])

  if (items.length === 0) return null

  return (
    <div>
      <div className="relative px-12">
        <p className="mb-1 text-center text-sm font-medium tabular-nums text-muted" aria-live="polite">
          {t('batchPage')(page + 1, pageCount)}
        </p>
        <ReelButton
          label={t('batchPrev')}
          direction="left"
          disabled={page === 0}
          onClick={() => setIndex(page - 1)}
        />
        <div className="overflow-hidden py-3">
          <ul
            className="flex w-full gap-3 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ transform: `translateX(calc(${start} * -1 * (100% + 0.75rem) / ${perPage}))` }}
          >
            {items.map((item) => (
              <BatchRow
                key={item.id}
                item={item}
                style={{ width: `calc((100% - ${(perPage - 1) * 0.75}rem) / ${perPage})` }}
                onOpen={onOpen}
                onRetry={onRetry}
                onRemove={onRemove}
              />
            ))}
          </ul>
        </div>
        <ReelButton
          label={t('batchNext')}
          direction="right"
          disabled={page >= pageCount - 1}
          onClick={() => setIndex(page + 1)}
        />
      </div>
    </div>
  )
}

function ReelButton({
  label,
  direction,
  disabled,
  onClick,
}: {
  label: string
  direction: 'left' | 'right'
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`absolute top-1/2 grid h-10 w-10 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-sunken text-cream ring-1 ring-line transition duration-200 hover:bg-cream hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-sunken disabled:hover:text-cream ${
        direction === 'left' ? 'left-0' : 'right-0'
      }`}
    >
      <ChevronIcon className={`h-4 w-4 ${direction === 'left' ? 'rotate-90' : '-rotate-90'}`} />
    </button>
  )
}

function usePageSize() {
  const query = '(min-width: 768px)'
  const [perPage, setPerPage] = useState(() => (window.matchMedia(query).matches ? 2 : 1))

  useEffect(() => {
    const media = window.matchMedia(query)
    const sync = () => setPerPage(media.matches ? 2 : 1)
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  return perPage
}

function BatchRow({
  item,
  style,
  onOpen,
  onRetry,
  onRemove,
}: {
  item: BatchItem
  style: CSSProperties
  onOpen: (id: string) => void
  onRetry: (id: string) => void
  onRemove: (id: string) => void
}) {
  const { t } = useI18n()
  const ready = isReady(item)
  const result = item.result
  const savings = ready && result ? savingsOf(item.bytes, result.bytes) : null
  const detail = [
    FORMAT_META[item.settings.format].label,
    `${item.settings.quality}%`,
    ready && result ? `${formatBytes(item.bytes)} → ${formatBytes(result.bytes)}` : item.status === 'error' ? t('encodeFailed') : t('batchWorking'),
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li
      style={style}
      className="group relative shrink-0 overflow-hidden rounded-3xl bg-sunken ring-1 ring-line transition duration-200 hover:bg-panel hover:ring-cream/35 hover:shadow-[0_18px_40px_rgba(0,0,0,0.22)]"
    >
      <button
        type="button"
        onClick={() => onOpen(item.id)}
        className="flex w-full cursor-pointer flex-col text-left"
      >
        <span className="relative aspect-[4/3] overflow-hidden">
          <img
            src={result?.url ?? item.thumbUrl}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
          />
          <span className="pointer-events-none absolute inset-0 bg-ink/0 transition duration-300 group-hover:bg-ink/20" />
          {item.customized ? (
            <span className="absolute bottom-3 left-3 rounded-full bg-ink/80 px-2.5 py-1 text-xs font-semibold text-accent ring-1 ring-accent/40">
              {t('batchCustom')}
            </span>
          ) : null}
        </span>
        <span className="flex min-w-0 flex-col gap-1 px-3.5 py-3">
          <span className="truncate font-medium transition duration-200 group-hover:text-cream">{item.name}</span>
          <span className={`truncate text-sm ${item.status === 'error' ? 'text-accent' : 'text-muted'}`}>{detail}</span>
          {savings?.kind === 'smaller' ? <span className="text-sm text-accent">{t('smaller')(savings.percent)}</span> : null}
          {savings?.kind === 'larger' ? <span className="text-sm text-muted">{t('larger')(savings.percent)}</span> : null}
        </span>
      </button>
      {item.status === 'error' ? (
        <button
          type="button"
          onClick={() => onRetry(item.id)}
          className="mx-3.5 mb-3 h-8 w-fit cursor-pointer rounded-full bg-panel px-3 text-sm font-semibold text-cream ring-1 ring-line transition duration-200 hover:bg-cream hover:text-ink"
        >
          {t('retry')}
        </button>
      ) : null}
      <button
        type="button"
        aria-label={t('batchRemove')}
        onClick={() => onRemove(item.id)}
        className="absolute top-3 right-3 grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-ink/75 text-cream/80 ring-1 ring-white/15 backdrop-blur-sm transition duration-200 hover:bg-ink hover:text-cream"
      >
        <CloseIcon className="h-4 w-4" />
      </button>
    </li>
  )
}

function UnitButton({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`cursor-pointer rounded-xl px-3 text-sm font-semibold transition duration-200 ${
        pressed ? 'bg-cream text-ink' : 'text-muted hover:text-cream'
      }`}
    >
      {children}
    </button>
  )
}

function isReady(item: BatchItem) {
  return item.status === 'done' && item.result != null && sameSettings(item.result.settings, item.settings)
}

function uniqueNames(names: string[]) {
  const used = new Set<string>()
  return names.map((name) => {
    const extension = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : ''
    const stem = fileStem(name)
    let next = name
    let index = 2
    while (used.has(next.toLowerCase())) {
      next = extension ? `${stem}-${index}.${extension}` : `${stem}-${index}`
      index += 1
    }
    used.add(next.toLowerCase())
    return next
  })
}
