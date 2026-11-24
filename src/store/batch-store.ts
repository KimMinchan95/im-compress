import { create } from 'zustand'
import { isResultCurrent, isSupportedFile } from '../lib/files'
import type { CompressSettings, OutputFormat } from '../types'
import { useEditorStore } from './editor-store'
import { usePresets } from './preset-store'

export type BatchStatus = 'queued' | 'encoding' | 'done' | 'error'

export interface BatchResult {
  url: string
  blob: Blob
  bytes: number
  width: number
  height: number
  format: OutputFormat
  quality: number
  settings: CompressSettings
}

export interface BatchItem {
  id: string
  file: File
  name: string
  bytes: number
  width: number
  height: number
  thumbUrl: string
  status: BatchStatus
  customized: boolean
  settings: CompressSettings
  result: BatchResult | null
}

interface BatchStore {
  items: BatchItem[]
  settings: CompressSettings
  editingId: string | null
  isOpening: boolean
  skipped: number
  delay: number
  jobVersion: number
  openFiles: (files: File[]) => Promise<void>
  addFiles: (files: File[]) => Promise<void>
  applyShared: (settings: CompressSettings) => void
  setFormat: (format: CompressSettings['format']) => void
  setQuality: (quality: number) => void
  setScale: (scale: number) => void
  setSizeMode: (sizeMode: CompressSettings['sizeMode']) => void
  setTargetBytes: (targetBytes: number | null) => void
  openItem: (id: string) => Promise<void>
  commitEdit: () => void
  retryItem: (id: string) => void
  removeItem: (id: string) => void
  close: () => void
  finishItem: (id: string, result: Omit<BatchResult, 'url'>) => void
  failItem: (id: string) => void
}

const DEFAULTS: CompressSettings = {
  format: 'jpeg',
  quality: 80,
  scale: 100,
  sizeMode: 'dimensions',
  targetBytes: null,
}

let requestId = 0

export function sameSettings(left: CompressSettings, right: CompressSettings) {
  if (left.format !== right.format || left.sizeMode !== right.sizeMode) return false
  if (left.format !== 'png' && left.quality !== right.quality) return false
  if (left.sizeMode === 'bytes') return left.targetBytes === right.targetBytes
  return Math.abs(left.scale - right.scale) < 0.2
}

function cleanSettings(settings: CompressSettings, scaleCap: number): CompressSettings {
  const bytes = settings.sizeMode === 'bytes'
  const targetBytes = bytes && settings.targetBytes != null && settings.targetBytes >= 1 ? Math.round(settings.targetBytes) : null
  return {
    format: settings.format,
    quality: Math.min(100, Math.max(1, Math.round(settings.quality))),
    scale: Math.min(scaleCap, Math.max(1, Math.round(settings.scale * 10) / 10)),
    sizeMode: bytes ? 'bytes' : 'dimensions',
    targetBytes,
  }
}

function presetSettings() {
  const { presets, defaultId } = usePresets.getState()
  const preset = presets.find((item) => item.id === defaultId)
  if (!preset) return DEFAULTS
  return cleanSettings(
    {
      format: preset.format,
      quality: preset.quality,
      scale: preset.scale,
      sizeMode: preset.sizeMode,
      targetBytes: preset.sizeMode === 'bytes' ? preset.targetBytes : null,
    },
    100,
  )
}

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now()}-${Math.round(Math.random() * 10000)}`
}

function releaseItem(item: BatchItem) {
  URL.revokeObjectURL(item.thumbUrl)
  if (item.result) URL.revokeObjectURL(item.result.url)
}

async function readItem(file: File, settings: CompressSettings) {
  if (!isSupportedFile(file)) return null
  try {
    const bitmap = await createImageBitmap(file)
    const width = bitmap.width
    const height = bitmap.height
    bitmap.close()
    if (width < 1 || height < 1) return null
    return {
      id: createId(),
      file,
      name: file.name,
      bytes: file.size,
      width,
      height,
      thumbUrl: URL.createObjectURL(file),
      status: 'queued' as const,
      customized: false,
      settings,
      result: null,
    }
  } catch {
    return null
  }
}

async function readPool(files: File[], settings: CompressSettings) {
  const results: Array<BatchItem | null> = new Array(files.length)
  let cursor = 0

  const worker = async () => {
    while (cursor < files.length) {
      const index = cursor
      cursor += 1
      results[index] = await readItem(files[index], settings)
    }
  }

  await Promise.all(Array.from({ length: Math.min(2, files.length) }, () => worker()))
  return results.filter((item): item is BatchItem => item !== null)
}

function share(state: Pick<BatchStore, 'settings' | 'items'>, settings: CompressSettings) {
  const next = cleanSettings(settings, 100)
  return {
    settings: next,
    delay: 280,
    items: state.items.map((item) => (item.customized ? item : { ...item, settings: next })),
  }
}

export function prepareQueue() {
  useBatchStore.setState((state) => ({
    items: state.items.map((item) => {
      const settings = item.customized ? item.settings : state.settings
      const ready = item.status === 'done' && item.result != null && sameSettings(item.result.settings, settings)
      if (ready) return sameSettings(item.settings, settings) ? item : { ...item, settings }
      if (item.customized && item.status === 'error') return item
      if (item.status === 'queued' && sameSettings(item.settings, settings)) return item
      return { ...item, settings, status: 'queued' as const }
    }),
  }))
}

export const useBatchStore = create<BatchStore>((set, get) => ({
  items: [],
  settings: DEFAULTS,
  editingId: null,
  isOpening: false,
  skipped: 0,
  delay: 280,
  jobVersion: 0,

  openFiles: async (files) => {
    const id = ++requestId
    const settings = presetSettings()
    set({ isOpening: true, settings, skipped: 0, editingId: null })
    useEditorStore.setState({ error: null })
    const ready = await readPool(files, settings)
    if (id !== requestId) {
      for (const item of ready) releaseItem(item)
      return
    }
    if (ready.length === 0) {
      set({ isOpening: false })
      useEditorStore.setState({ error: files.every((file) => !isSupportedFile(file)) ? 'unsupported' : 'unreadable' })
      return
    }
    set((state) => ({
      isOpening: false,
      skipped: files.length - ready.length,
      items: ready,
      settings,
      delay: 0,
      jobVersion: state.jobVersion + 1,
    }))
  },

  addFiles: async (files) => {
    const id = ++requestId
    const settings = get().settings
    const ready = await readPool(files, settings)
    if (id !== requestId) {
      for (const item of ready) releaseItem(item)
      return
    }
    const skipped = files.length - ready.length
    if (ready.length === 0) {
      if (skipped > 0) set((state) => ({ skipped: state.skipped + skipped }))
      return
    }
    set((state) => ({
      skipped: state.skipped + skipped,
      items: [...state.items, ...ready],
      delay: 0,
      jobVersion: state.jobVersion + 1,
    }))
  },

  applyShared: (settings) => set((state) => share(state, settings)),
  setFormat: (format) => set((state) => share(state, { ...state.settings, format })),
  setQuality: (quality) => set((state) => share(state, { ...state.settings, quality })),
  setScale: (scale) => set((state) => share(state, { ...state.settings, scale })),
  setSizeMode: (sizeMode) =>
    set((state) =>
      share(state, {
        ...state.settings,
        sizeMode,
        targetBytes: sizeMode === 'bytes' ? state.settings.targetBytes : null,
      }),
    ),
  setTargetBytes: (targetBytes) =>
    set((state) => share(state, { ...state.settings, sizeMode: 'bytes', targetBytes })),

  openItem: async (id) => {
    const item = get().items.find((entry) => entry.id === id)
    if (!item || useEditorStore.getState().isReading) return
    set({ editingId: id })
    const opened = await useEditorStore.getState().loadFile(item.file, item.settings)
    if (get().editingId !== id) return
    if (!opened) set((state) => ({ editingId: null, delay: 0, jobVersion: state.jobVersion + 1 }))
  },

  commitEdit: () => {
    const editingId = get().editingId
    const editor = useEditorStore.getState()
    const item = get().items.find((entry) => entry.id === editingId)
    if (!editingId || !item || !editor.source) {
      if (editor.source) editor.leave()
      set((state) => ({ editingId: null, delay: 0, jobVersion: state.jobVersion + 1 }))
      return
    }

    const nextSettings = cleanSettings(
      {
        format: editor.format,
        quality: editor.quality,
        scale: editor.scale,
        sizeMode: editor.sizeMode,
        targetBytes: editor.targetBytes,
      },
      1000,
    )
    const current = editor.result
    const fresh =
      current != null &&
      isResultCurrent(current, {
        format: editor.format,
        width: editor.width,
        height: editor.height,
        quality: editor.quality,
      })
    const file = editor.source.blob instanceof File ? editor.source.blob : item.file
    const fileChanged = file !== item.file
    const sourceWidth = editor.source.width
    const sourceHeight = editor.source.height
    let result = item.result
    if (fresh && current) {
      const url = item.result?.blob === current.blob ? item.result.url : URL.createObjectURL(current.blob)
      if (item.result && item.result.url !== url) URL.revokeObjectURL(item.result.url)
      result = {
        url,
        blob: current.blob,
        bytes: current.bytes,
        width: current.width,
        height: current.height,
        format: current.format,
        quality: current.quality,
        settings: nextSettings,
      }
    }
    const thumbUrl = fileChanged ? URL.createObjectURL(file) : item.thumbUrl
    if (fileChanged) URL.revokeObjectURL(item.thumbUrl)
    editor.leave()

    set((state) => ({
      editingId: null,
      delay: 0,
      jobVersion: state.jobVersion + 1,
      items: state.items.map((entry) =>
        entry.id === item.id
          ? {
              ...entry,
              file,
              name: file.name,
              bytes: file.size,
              width: fileChanged ? sourceWidth : entry.width,
              height: fileChanged ? sourceHeight : entry.height,
              thumbUrl,
              status: fresh ? 'done' : 'queued',
              customized: !sameSettings(nextSettings, state.settings),
              settings: nextSettings,
              result,
            }
          : entry,
      ),
    }))
  },

  retryItem: (id) =>
    set((state) => ({
      delay: 0,
      jobVersion: state.jobVersion + 1,
      items: state.items.map((item) => (item.id === id ? { ...item, status: 'queued' } : item)),
    })),

  removeItem: (id) => {
    const item = get().items.find((entry) => entry.id === id)
    if (!item) return
    releaseItem(item)
    set((state) => ({ items: state.items.filter((entry) => entry.id !== id) }))
  },

  close: () => {
    requestId += 1
    for (const item of get().items) releaseItem(item)
    set({ items: [], editingId: null, isOpening: false, skipped: 0 })
  },

  finishItem: (id, payload) =>
    set((state) => {
      const index = state.items.findIndex((item) => item.id === id)
      if (index < 0) return state
      const item = state.items[index]
      if (item.status !== 'encoding' || !sameSettings(item.settings, payload.settings)) return state
      if (item.result) URL.revokeObjectURL(item.result.url)
      const items = state.items.slice()
      items[index] = {
        ...item,
        status: 'done',
        result: { ...payload, url: URL.createObjectURL(payload.blob) },
      }
      return { items }
    }),

  failItem: (id) =>
    set((state) => {
      const index = state.items.findIndex((item) => item.id === id)
      if (index < 0) return state
      const item = state.items[index]
      if (item.status !== 'encoding') return state
      const items = state.items.slice()
      items[index] = { ...item, status: 'error' }
      return { items }
    }),
}))
