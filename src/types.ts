export type OutputFormat = 'jpeg' | 'webp' | 'png'

export type SizeMode = 'bytes' | 'dimensions'

export type EncodeStatus = 'idle' | 'encoding' | 'error'

export type CompareMode = 'original' | 'result' | 'split'

export type EditorErrorCode = 'unsupported' | 'unreadable' | 'encode-failed'

export interface CompressSettings {
  format: OutputFormat
  quality: number
  scale: number
  sizeMode: SizeMode
  targetBytes: number | null
}

export interface SourceImage {
  name: string
  bytes: number
  width: number
  height: number
  url: string
  blob: Blob
  file: File
}

export interface EncodeResult {
  url: string
  blob: Blob
  downloadId: string
  bytes: number
  width: number
  height: number
  format: OutputFormat
  quality: number
}

export interface EncodeRequest {
  id: number
  source: Blob
  format: OutputFormat
  quality: number
  width: number
  height: number
  /** Lossless PNG optimisation (oxipng). Defaults to true; search passes skip it for speed. */
  optimize?: boolean
}

/** Decodes a HEIC/HEIF file to PNG inside a dedicated worker so the main thread stays responsive. */
export interface HeicDecodeRequest {
  id: number
  source: Blob
}

/** Shared reply shape for every worker: a blob on success, otherwise a short error reason. */
export interface EncodeResponse {
  id: number
  blob?: Blob
  /** Short machine-readable reason when no blob is produced. */
  error?: string
}
