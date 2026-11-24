import type { EncodeResult, OutputFormat } from '../types'
import { directDownloadUrl } from './download-bridge'

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

export function isKakaoTalk() {
  return /KAKAOTALK/i.test(navigator.userAgent)
}

export function kakaoExternalUrl(pageUrl: string) {
  return `kakaotalk://web/openExternal?url=${encodeURIComponent(pageUrl)}`
}

export function openKakaoExternal() {
  window.location.assign(kakaoExternalUrl(window.location.href))
}

let didLeaveKakao = false

export function leaveKakaoOnce() {
  if (didLeaveKakao) return
  didLeaveKakao = true
  openKakaoExternal()
}

export function isAndroid() {
  return /Android/i.test(navigator.userAgent)
}

function isIos() {
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

const IMAGE_MIME = new Set(Object.values(FORMAT_META).map((meta) => meta.mime))

export type SaveOutcome = 'saved' | 'cancelled' | 'failed' | 'started' | 'requested'

function shareableFile(blob: Blob, filename: string, mime: string) {
  if (typeof navigator.share !== 'function' || !IMAGE_MIME.has(mime)) return null
  const file = new File([blob], filename, { type: mime })
  if (typeof navigator.canShare !== 'function') return file
  try {
    return navigator.canShare({ files: [file] }) ? file : null
  } catch {
    return null
  }
}

function shareImage(blob: Blob, filename: string, mime: string) {
  const file = shareableFile(blob, filename, mime)
  if (!file) return Promise.resolve<SaveOutcome>('failed')
  return navigator.share({ files: [file] }).then(
    () => 'saved' as const,
    (error: unknown) => (error instanceof DOMException && error.name === 'AbortError' ? 'cancelled' : 'failed'),
  )
}

export async function ensureMime(blob: Blob, mime: string) {
  if (blob.type === mime) return blob
  return new Blob([await blob.arrayBuffer()], { type: mime })
}

function anchorDownload(url: string, filename: string, removeAfter = 0) {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  if (removeAfter > 0) window.setTimeout(() => anchor.remove(), removeAfter)
  else anchor.remove()
}

function openDownload(url: string) {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.removeAttribute('download')
  document.body.appendChild(anchor)
  anchor.click()
  window.setTimeout(() => anchor.remove(), 1500)
}

const KAKAO_DATA_URL_LIMIT = 12 * 1024 * 1024

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('data-url'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('data-url'))
    reader.readAsDataURL(blob)
  })
}

function saveOnAndroid(downloadId: string | null, filename: string): Promise<SaveOutcome> {
  const direct = directDownloadUrl(downloadId, filename)
  if (!direct) return Promise.resolve('failed')
  openDownload(direct)
  return Promise.resolve('requested')
}

async function saveInKakao(blob: Blob, filename: string): Promise<SaveOutcome> {
  if (!isIos()) return 'failed'
  if (blob.size > KAKAO_DATA_URL_LIMIT) return 'failed'
  try {
    anchorDownload(await blobToDataUrl(blob), filename, 1500)
    return 'started'
  } catch {
    return 'failed'
  }
}

export function saveFile(
  blob: Blob,
  url: string,
  filename: string,
  mime: string,
  downloadId: string | null,
): Promise<SaveOutcome> {
  if (isKakaoTalk()) return saveInKakao(blob, filename)
  if (isAndroid()) return saveOnAndroid(downloadId, filename)
  if (isIos()) return shareImage(blob, filename, mime)

  anchorDownload(url, filename)
  return Promise.resolve('started')
}

export function takeFile(input: HTMLInputElement) {
  const file = input.files?.[0] ?? null
  input.value = ''
  return file
}

export function takeFiles(input: HTMLInputElement) {
  const files = Array.from(input.files ?? [])
  input.value = ''
  return files
}

export async function saveDownload(blob: Blob, filename: string): Promise<SaveOutcome> {
  if (isKakaoTalk()) return saveInKakao(blob, filename)
  if (isIos()) {
    const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' })
    if (typeof navigator.share === 'function') {
      try {
        const allowed = typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] })
        if (allowed) {
          await navigator.share({ files: [file] })
          return 'saved'
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
      }
    }
  }

  const url = URL.createObjectURL(blob)
  anchorDownload(url, filename)
  window.setTimeout(() => URL.revokeObjectURL(url), 30000)
  return 'started'
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
