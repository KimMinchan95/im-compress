import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { FORMAT_META } from '../lib/files'
import type { OutputFormat } from '../types'

export const PRESET_LIMIT = 8

export interface SavedPreset {
  id: string
  name: string
  format: OutputFormat
  quality: number
  scale: number
}

interface PresetState {
  presets: SavedPreset[]
  savePreset: (input: Omit<SavedPreset, 'id'>) => 'saved' | 'limit'
  removePreset: (id: string) => void
}

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.round(Math.random() * 10000)}`
}

export function presetName(format: OutputFormat, quality: number, scale: number) {
  const label = FORMAT_META[format].label
  if (format === 'png') return `${label} · ${scale}%`
  return `${label} ${quality}% · ${scale}%`
}

export const usePresets = create<PresetState>()(
  persist(
    (set, get) => ({
      presets: [],
      savePreset: (input) => {
        if (get().presets.length >= PRESET_LIMIT) return 'limit'
        const name = input.name.trim().slice(0, 40) || presetName(input.format, input.quality, input.scale)
        const preset: SavedPreset = {
          id: createId(),
          name,
          format: input.format,
          quality: input.quality,
          scale: input.scale,
        }
        set({ presets: [preset, ...get().presets] })
        return 'saved'
      },
      removePreset: (id) => set({ presets: get().presets.filter((preset) => preset.id !== id) }),
    }),
    { name: 'im-compress-presets' },
  ),
)
