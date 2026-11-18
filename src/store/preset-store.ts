import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { formatBytes } from '../lib/format-bytes'
import { FORMAT_META } from '../lib/files'
import type { OutputFormat, SizeMode } from '../types'

export const PRESET_LIMIT = 8

export interface SavedPreset {
  id: string
  name: string
  format: OutputFormat
  quality: number
  scale: number
  sizeMode: SizeMode
  targetBytes: number | null
}

interface PresetState {
  presets: SavedPreset[]
  defaultId: string | null
  savePreset: (input: Omit<SavedPreset, 'id'>) => 'saved' | 'limit'
  removePreset: (id: string) => void
  setDefault: (id: string) => void
}

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.round(Math.random() * 10000)}`
}

type PresetDraft = Pick<SavedPreset, 'format' | 'quality' | 'scale' | 'sizeMode' | 'targetBytes'>

export function presetName(
  format: OutputFormat,
  quality: number,
  scale: number,
  targetBytes: number | null = null,
  sizeMode: SizeMode = 'dimensions',
) {
  const label = FORMAT_META[format].label
  if (sizeMode === 'bytes') {
    if (format === 'png') return targetBytes ? `${label} · ${formatBytes(targetBytes)}` : label
    const qualityLabel = `${label} ${quality}%`
    return targetBytes ? `${qualityLabel} · ${formatBytes(targetBytes)}` : qualityLabel
  }
  if (format === 'png') return `${label} · ${scale}%`
  return `${label} ${quality}% · ${scale}%`
}

export function isSamePreset(preset: SavedPreset, draft: PresetDraft) {
  if (preset.format !== draft.format || preset.quality !== draft.quality || preset.sizeMode !== draft.sizeMode) {
    return false
  }
  if (draft.sizeMode === 'bytes') return preset.targetBytes === draft.targetBytes
  return preset.scale === draft.scale
}

function sizeModeOf(preset: Partial<SavedPreset>): SizeMode {
  if (preset.sizeMode === 'bytes' || preset.sizeMode === 'dimensions') return preset.sizeMode
  return typeof preset.targetBytes === 'number' ? 'bytes' : 'dimensions'
}

function isFormat(value: unknown): value is OutputFormat {
  return value === 'jpeg' || value === 'webp' || value === 'png'
}

export const usePresets = create<PresetState>()(
  persist(
    (set, get) => ({
      presets: [],
      defaultId: null,
      savePreset: (input) => {
        if (get().presets.length >= PRESET_LIMIT) return 'limit'
        const targetBytes = input.sizeMode === 'bytes' ? input.targetBytes : null
        const name =
          input.name.trim().slice(0, 40) ||
          presetName(input.format, input.quality, input.scale, targetBytes, input.sizeMode)
        const preset: SavedPreset = {
          id: createId(),
          name,
          format: input.format,
          quality: input.quality,
          scale: input.scale,
          sizeMode: input.sizeMode,
          targetBytes,
        }
        set({ presets: [preset, ...get().presets] })
        return 'saved'
      },
      removePreset: (id) =>
        set({
          presets: get().presets.filter((preset) => preset.id !== id),
          defaultId: get().defaultId === id ? null : get().defaultId,
        }),
      setDefault: (id) => set({ defaultId: get().defaultId === id ? null : id }),
    }),
    {
      name: 'im-compress-presets',
      version: 2,
      migrate: (persisted) => {
        const state = (persisted ?? {}) as { presets?: Array<Partial<SavedPreset>>; defaultId?: string | null }
        const presets = (state.presets ?? []).flatMap((preset) => {
          if (!preset.id || !preset.name || !isFormat(preset.format)) return []
          if (typeof preset.quality !== 'number' || typeof preset.scale !== 'number') return []
          const sizeMode = sizeModeOf(preset)
          return [
            {
              id: preset.id,
              name: preset.name,
              format: preset.format,
              quality: preset.quality,
              scale: preset.scale,
              sizeMode,
              targetBytes: sizeMode === 'bytes' && typeof preset.targetBytes === 'number' ? preset.targetBytes : null,
            },
          ]
        })
        const defaultId = presets.some((preset) => preset.id === state.defaultId) ? state.defaultId ?? null : null
        return { presets, defaultId }
      },
    },
  ),
)
