import type { EncodeResult, OutputFormat } from '../types'

export const FORMAT_META: Record<OutputFormat, { label: string; mime: string; extension: string }> = {
  jpeg: { label: 'JPG', mime: 'image/jpeg', extension: 'jpg' },
  webp: { label: 'WebP', mime: 'image/webp', extension: 'webp' },
  png: { label: 'PNG', mime: 'image/png', extension: 'png' },
}

export const FORMATS: OutputFormat[] = ['jpeg', 'webp', 'png']

export const QUALITY_PRESETS = [
  { id: 'low', value: 40 },
  { id: 'medium', value: 65 },
  { id: 'high', value: 80 },
  { id: 'best', value: 92 },
] as const

const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.webp', '.png']

export const FILE_ACCEPT = ['image/jpeg', 'image/webp', 'image/png', ...SUPPORTED_EXTENSIONS].join(',')

export function isSupportedFile(file: File) {
  if (SUPPORTED_TYPES.has(file.type)) return true
  const name = file.name.toLowerCase()
  return SUPPORTED_EXTENSIONS.some((extension) => name.endsWith(extension))
}

function stripExtension(name: string) {
  return name.replace(/\.[^.]+$/, '')
}

export function fileStem(fileName: string) {
  const stem = stripExtension(fileName).trim()
  return stem || fileName
}

export function downloadName(name: string, format: OutputFormat) {
  const base = stripExtension(name) || 'image'
  return `${base}.${FORMAT_META[format].extension}`
}

function prefersShare() {
  return window.matchMedia('(pointer: coarse)').matches || /Android/i.test(navigator.userAgent)
}

function canShareFile(file: File) {
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false
  try {
    return navigator.canShare({ files: [file] })
  } catch {
    return false
  }
}

function shareableFile(blob: Blob, filename: string) {
  const typed = new File([blob], filename, { type: blob.type || 'application/octet-stream' })
  if (canShareFile(typed)) return typed
  if (typed.type === 'application/octet-stream') return null
  const generic = new File([blob], filename, { type: 'application/octet-stream' })
  return canShareFile(generic) ? generic : null
}

function anchorDownload(url: string, filename: string) {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

export function saveFile(blob: Blob, url: string, filename: string) {
  if (prefersShare()) {
    const file = shareableFile(blob, filename)
    if (file) {
      void navigator.share({ files: [file] }).catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        anchorDownload(url, filename)
      })
      return
    }
  }

  anchorDownload(url, filename)
}

export function takeFile(input: HTMLInputElement) {
  const file = input.files?.[0] ?? null
  input.value = ''
  return file
}

export function isResultCurrent(
  result: EncodeResult,
  options: { format: OutputFormat; width: number; height: number; quality: number },
) {
  if (result.format !== options.format) return false
  if (result.width !== options.width || result.height !== options.height) return false
  if (options.format !== 'png' && result.quality !== options.quality) return false
  return true
}
