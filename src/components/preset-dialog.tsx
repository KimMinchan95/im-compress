import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { FORMAT_META } from '../lib/files'
import { formatBytes } from '../lib/format-bytes'
import { useI18n } from '../lib/use-i18n'
import { useEditorStore } from '../store/editor-store'
import { formatScale, useBatchPresets, usePresets, type SavedPreset } from '../store/preset-store'
import { CloseIcon } from './icons'

interface PresetDialogProps {
  onClose: () => void
  onApply?: (preset: SavedPreset) => void
  list?: 'single' | 'batch'
}

export function PresetDialog({ onClose, onApply, list = 'single' }: PresetDialogProps) {
  const { t } = useI18n()
  const dialogRef = useRef<HTMLDivElement>(null)
  const singlePresets = usePresets((state) => state.presets)
  const batchPresets = useBatchPresets((state) => state.presets)
  const singleDefaultId = usePresets((state) => state.defaultId)
  const batchDefaultId = useBatchPresets((state) => state.defaultId)
  const removeSingle = usePresets((state) => state.removePreset)
  const removeBatch = useBatchPresets((state) => state.removePreset)
  const setSingleDefault = usePresets((state) => state.setDefault)
  const setBatchDefault = useBatchPresets((state) => state.setDefault)
  const presets = list === 'batch' ? batchPresets : singlePresets
  const defaultId = list === 'batch' ? batchDefaultId : singleDefaultId
  const removePreset = list === 'batch' ? removeBatch : removeSingle
  const setDefault = list === 'batch' ? setBatchDefault : setSingleDefault
  const applySettings = useEditorStore((state) => state.applySettings)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    dialogRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const apply = (preset: SavedPreset) => {
    if (onApply) onApply(preset)
    else applySettings(preset)
    onClose()
  }

  return createPortal(
    <div
      className="overlay-in fixed inset-0 z-50 grid place-items-end bg-ink/75 px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:place-items-center"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="preset-dialog-title"
        tabIndex={-1}
        className="flex max-h-[min(32rem,calc(100dvh-3rem))] w-full max-w-md flex-col rounded-3xl bg-panel p-5 shadow-2xl ring-1 ring-line outline-none"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="preset-dialog-title" className="text-lg font-semibold tracking-tight">
            {t('saved')}
          </h2>
          <button
            type="button"
            aria-label={t('close')}
            onClick={onClose}
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-full text-muted transition hover:bg-sunken hover:text-cream"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        {presets.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">{t('emptyPresets')}</p>
        ) : (
          <ul className="mt-4 flex min-h-0 flex-col gap-2 overflow-y-auto">
            {presets.map((preset) => {
              const summary = presetSummary(preset, t)
              const isDefault = preset.id === defaultId
              return (
                <li key={preset.id} className="flex flex-col gap-2 rounded-2xl bg-sunken px-3 py-2.5 ring-1 ring-line">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium whitespace-nowrap">{summary}</span>
                    {isDefault ? (
                      <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
                        {t('defaultPreset')}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => apply(preset)}
                      className="h-9 flex-1 cursor-pointer rounded-full bg-cream px-3 text-sm font-semibold text-ink transition active:scale-[0.97]"
                    >
                      {t('load')}
                    </button>
                    <button
                      type="button"
                      aria-pressed={isDefault}
                      aria-label={isDefault ? t('clearDefault') : t('setDefault')}
                      onClick={() => setDefault(preset.id)}
                      className={`h-9 flex-1 cursor-pointer rounded-full px-3 text-sm font-semibold transition active:scale-[0.97] ${
                        isDefault ? 'bg-accent text-on-accent' : 'bg-panel text-cream ring-1 ring-line'
                      }`}
                    >
                      {t('defaultPreset')}
                    </button>
                    <button
                      type="button"
                      onClick={() => removePreset(preset.id)}
                      className="h-9 shrink-0 cursor-pointer px-2 text-sm text-muted transition hover:text-cream"
                    >
                      {t('remove')}
                    </button>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>,
    document.body,
  )
}

function presetSummary(preset: SavedPreset, t: ReturnType<typeof useI18n>['t']) {
  const size =
    preset.sizeMode === 'bytes' && preset.targetBytes
      ? t('presetBytes')(formatBytes(preset.targetBytes))
      : t('presetScale')(formatScale(preset.scale))
  const parts = [`${t('format')}: ${FORMAT_META[preset.format].label}`]
  if (preset.format !== 'png') parts.push(`${t('quality')}: ${preset.quality}%`)
  parts.push(size)
  return parts.join(' · ')
}

