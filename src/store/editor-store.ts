import { create } from 'zustand'
import { sizeFromHeight, sizeFromScale, sizeFromWidth } from '../lib/aspect'
import { formatFromFile, isSupportedFile } from '../lib/files'
import type { CompareView, EditorErrorCode, EncodeResult, EncodeStatus, OutputFormat, SourceImage } from '../types'

const DEFAULT_QUALITY = 80

interface EditorStore {
  source: SourceImage | null
  format: OutputFormat
  quality: number
  width: number
  height: number
  scale: number
  result: EncodeResult | null
  view: CompareView
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
  resetSize: () => void
  setView: (view: CompareView) => void
  toggleView: () => void
  retry: () => void
  beginEncode: () => void
  applyResult: (result: EncodeResult) => void
  applyError: (error: EditorErrorCode) => void
}

function releaseLater(url: string) {
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  source: null,
  format: 'jpeg',
  quality: DEFAULT_QUALITY,
  width: 0,
  height: 0,
  scale: 100,
  result: null,
  view: 'result',
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
      if (current.source) releaseLater(current.source.url)
      if (current.result) releaseLater(current.result.url)

      set({
        source: {
          name: file.name,
          bytes: file.size,
          width,
          height,
          url: URL.createObjectURL(file),
          blob: file,
        },
        format: formatFromFile(file),
        quality: DEFAULT_QUALITY,
        width: fitted.width,
        height: fitted.height,
        scale: fitted.scale,
        result: null,
        view: 'result',
        status: 'idle',
        error: null,
        isReading: false,
      })
    } catch {
      set({
        isReading: false,
        error: 'unreadable',
      })
    }
  },

  setFormat: (format) => set({ format }),

  setQuality: (quality) => {
    set({ quality: Math.min(100, Math.max(1, Math.round(quality))) })
  },

  setWidth: (width) => {
    const source = get().source
    if (!source) return
    set(sizeFromWidth(source.width, source.height, width))
  },

  setHeight: (height) => {
    const source = get().source
    if (!source) return
    set(sizeFromHeight(source.width, source.height, height))
  },

  setScale: (scale) => {
    const source = get().source
    if (!source) return
    set(sizeFromScale(source.width, source.height, scale))
  },

  resetSize: () => {
    const source = get().source
    if (!source) return
    set(sizeFromWidth(source.width, source.height, source.width))
  },

  setView: (view) => set({ view }),

  toggleView: () => {
    set({ view: get().view === 'original' ? 'result' : 'original' })
  },

  retry: () => set((state) => ({ retryToken: state.retryToken + 1, error: null })),

  beginEncode: () => set({ status: 'encoding', error: null }),

  applyResult: (result) => {
    const previous = get().result
    if (previous) releaseLater(previous.url)
    set({ result, status: 'idle', error: null })
  },

  applyError: (error) => set({ status: 'error', error }),
}))
