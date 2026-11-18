export type OutputFormat = 'jpeg' | 'webp' | 'png'

export type SizeMode = 'bytes' | 'dimensions'

export type EncodeStatus = 'idle' | 'encoding' | 'error'

export type CompareMode = 'original' | 'result' | 'split'

export type EditorErrorCode = 'unsupported' | 'unreadable' | 'encode-failed'

export interface SourceImage {
  name: string
  bytes: number
  width: number
  height: number
  url: string
  blob: Blob
}

export interface EncodeResult {
  url: string
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
}

export interface EncodeResponse {
  id: number
  blob?: Blob
}
