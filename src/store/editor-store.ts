import { create } from 'zustand'
import { sizeFromHeight, sizeFromScale, sizeFromWidth } from '../lib/aspect'
import { formatFromFile, isSupportedFile } from '../lib/files'
import type { CompareMode, EditorErrorCode, EncodeResult, EncodeStatus, OutputFormat, SizeMode, SourceImage } from '../types'
import { usePresets } from './preset-store'
import { useStageStore } from './stage-store'

const DEFAULT_QUALITY = 80

interface EditorStore {
  source: SourceImage | null
  format: OutputFormat
  quality: number
  width: number
  height: number
  scale: number
  targetBytes: number | null
  sizeMode: SizeMode
  matchedTarget: number | null
  result: EncodeResult | null
  compareMode: CompareMode
  status: EncodeStatus
  error: EditorErrorCode | null
  isReading: boolean
  retryToken: number
  loadFile: (file: File) => Promise<void>
  setFormat: (format: OutputFormat) => void
  setQuality: (quality: number) => void
  setWidth: (width: number) => void
  setHeight: (height: number) => void
  setScale: (scale: number) => void
  setTargetBytes: (targetBytes: number | null) => void
  setSizeMode: (sizeMode: SizeMode) => void
  applySettings: (settings: {
    format: OutputFormat
    quality: number
    scale: number
    sizeMode: SizeMode
    targetBytes: number | null
  }) => void
  resetSize: () => void
  leave: () => void
  setCompareMode: (compareMode: CompareMode) => void
  retry: () => void
  beginEncode: () => void
  applyResult: (result: EncodeResult) => void
  applyMatched: (matched: {
    result: EncodeResult
    quality: number
    width: number
    height: number
    scale: number
  }) => void
  applyError: (error: EditorErrorCode) => void
}

function releaseLater(url: string) {
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function releaseMedia(current: { source: SourceImage | null; result: EncodeResult | null }) {
  if (current.source) releaseLater(current.source.url)
  if (current.result) releaseLater(current.result.url)
}

function clampQuality(quality: number) {
  return Math.min(100, Math.max(1, Math.round(quality)))
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  source: null,
  format: 'jpeg',
  quality: DEFAULT_QUALITY,
  width: 0,
  height: 0,
  scale: 100,
  targetBytes: null,
  sizeMode: 'dimensions',
  matchedTarget: null,
  result: null,
  compareMode: 'split',
  status: 'idle',
  error: null,
  isReading: false,
  retryToken: 0,

  loadFile: async (file) => {
    if (!isSupportedFile(file)) {
      set({ error: 'unsupported' })
      return
    }

    set({ isReading: true, error: null })

    try {
      const bitmap = await createImageBitmap(file)
      const width = bitmap.width
      const height = bitmap.height
      bitmap.close()

      if (width < 1 || height < 1) throw new Error('empty')

      const fitted = sizeFromWidth(width, height, width)
      const current = get()
      releaseMedia(current)
      const { presets, defaultId } = usePresets.getState()
      const preset = presets.find((item) => item.id === defaultId) ?? null
      const sized =
        preset?.sizeMode === 'dimensions' ? sizeFromScale(width, height, preset.scale) : fitted

      set({
        source: {
          name: file.name,
          bytes: file.size,
          width,
          height,
          url: URL.createObjectURL(file),
          blob: file,
        },
        format: preset?.format ?? formatFromFile(file),
        quality: preset?.quality ?? DEFAULT_QUALITY,
        width: sized.width,
        height: sized.height,
        scale: sized.scale,
        sizeMode: preset?.sizeMode ?? 'dimensions',
        targetBytes: preset?.sizeMode === 'bytes' ? preset.targetBytes : null,
        matchedTarget: null,
        result: null,
        status: 'idle',
        error: null,
        isReading: false,
      })
      useStageStore.getState().reset()
    } catch {
      set({
        isReading: false,
        error: 'unreadable',
      })
    }
  },

  setFormat: (format) => set({ format, matchedTarget: null }),

  setQuality: (quality) => set({ quality: clampQuality(quality), matchedTarget: null }),

  setWidth: (width) => {
    const source = get().source
    if (!source) return
    set({ ...sizeFromWidth(source.width, source.height, width), targetBytes: null, matchedTarget: null })
  },

  setHeight: (height) => {
    const source = get().source
    if (!source) return
    set({ ...sizeFromHeight(source.width, source.height, height), targetBytes: null, matchedTarget: null })
  },

  setScale: (scale) => {
    const source = get().source
    if (!source) return
    set({ ...sizeFromScale(source.width, source.height, scale), targetBytes: null, matchedTarget: null })
  },

  setTargetBytes: (targetBytes) => {
    if (targetBytes == null || targetBytes < 1) {
      set({ targetBytes: null, matchedTarget: null })
      return
    }
    set({ targetBytes: Math.round(targetBytes), sizeMode: 'bytes', matchedTarget: null })
  },

  setSizeMode: (sizeMode) => {
    if (sizeMode === 'bytes') {
      set({ sizeMode, matchedTarget: null })
      return
    }
    set({ sizeMode, targetBytes: null, matchedTarget: null })
  },

  applySettings: ({ format, quality, scale, sizeMode, targetBytes }) => {
    const source = get().source
    if (!source) return
    const bytes = sizeMode === 'bytes' && targetBytes != null && targetBytes >= 1 ? Math.round(targetBytes) : null
    const sized =
      sizeMode === 'dimensions'
        ? sizeFromScale(source.width, source.height, scale)
        : sizeFromWidth(source.width, source.height, source.width)
    set({
      format,
      quality: clampQuality(quality),
      ...sized,
      sizeMode,
      targetBytes: bytes,
      matchedTarget: null,
    })
  },

  resetSize: () => {
    const source = get().source
    if (!source) return
    set({ ...sizeFromWidth(source.width, source.height, source.width), targetBytes: null, matchedTarget: null })
  },

  leave: () => {
    releaseMedia(get())
    set({
      source: null,
      result: null,
      quality: DEFAULT_QUALITY,
      width: 0,
      height: 0,
      scale: 100,
      targetBytes: null,
      sizeMode: 'dimensions',
      matchedTarget: null,
      status: 'idle',
      error: null,
      isReading: false,
    })
    useStageStore.getState().reset()
  },

  setCompareMode: (compareMode) => set({ compareMode }),

  retry: () => set((state) => ({ retryToken: state.retryToken + 1, error: null, matchedTarget: null })),

  beginEncode: () => set({ status: 'encoding', error: null }),

  applyResult: (result) => {
    const previous = get().result
    if (previous) releaseLater(previous.url)
    set({ result, status: 'idle', error: null })
  },

  applyMatched: ({ result, quality, width, height, scale }) => {
    const previous = get().result
    if (previous) releaseLater(previous.url)
    set({
      result,
      quality,
      width,
      height,
      scale,
      matchedTarget: get().targetBytes,
      status: 'idle',
      error: null,
    })
  },

  applyError: (error) => set({ status: 'error', error }),
}))
