const ICC_MARKER = 0xe2
const JPEG_START = 0xd8
const JPEG_SCAN = 0xda
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]
const ICC_HEADER = [73, 67, 67, 95, 80, 82, 79, 70, 73, 76, 69, 0]
const DISPLAY_P3 = [68, 105, 115, 112, 108, 97, 121, 32, 80, 51]
const JPEG_CHUNK = 65_519
const PNG_DROP = new Set(['iCCP', 'sRGB', 'gAMA', 'cICP'])

interface Chunk {
  id: string
  data: Uint8Array
}

export async function readDisplayP3Profile(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const profile = await extractProfile(bytes)
  if (!profile || !isDisplayP3(profile)) return null
  return profile
}

export async function keepDisplayP3(blob: Blob, profile: Uint8Array, width: number, height: number) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  if (hasProfile(bytes)) return blob

  const embedded = blob.type === 'image/png'
    ? await embedPng(bytes, profile)
    : blob.type === 'image/webp'
      ? embedWebp(bytes, profile, width, height)
      : embedJpeg(bytes, profile)

  if (!embedded) return blob
  return blobFrom(embedded, blob.type || 'image/jpeg')
}

function isDisplayP3(profile: Uint8Array) {
  return includesBytes(profile, DISPLAY_P3) || includesBytes(profile, utf16le(DISPLAY_P3)) || includesBytes(profile, utf16be(DISPLAY_P3))
}

async function extractProfile(bytes: Uint8Array) {
  if (isPng(bytes)) return inflatePngProfile(bytes)
  if (isWebp(bytes)) return webpProfile(bytes)
  if (isJpeg(bytes)) return jpegProfile(bytes)
  return null
}

function hasProfile(bytes: Uint8Array) {
  if (isPng(bytes)) return pngHasProfile(bytes)
  if (isWebp(bytes)) return webpProfile(bytes) !== null
  if (isJpeg(bytes)) return jpegProfile(bytes) !== null
  return false
}

function jpegProfile(bytes: Uint8Array) {
  const parts: Array<Uint8Array | undefined> = []
  let count = 0

  const intact = walkJpeg(bytes, (marker, payload) => {
    if (marker !== ICC_MARKER || !startsWith(payload, ICC_HEADER) || payload.length < 14) return
    const index = payload[12]
    const total = payload[13]
    if (index < 1 || total < 1 || index > total) return
    if (count === 0) count = total
    if (total !== count) return
    parts[index - 1] = payload.slice(14)
  })

  if (!intact || count === 0 || parts.length !== count || parts.some((part) => !part)) return null
  return concat(parts.filter((part): part is Uint8Array => part !== undefined))
}

async function inflatePngProfile(bytes: Uint8Array) {
  const chunk = pngChunk(bytes, 'iCCP')
  if (!chunk) return null
  const split = chunk.indexOf(0)
  if (split < 1 || split > 79 || split + 2 >= chunk.length || chunk[split + 1] !== 0) return null

  try {
    const stream = new DecompressionStream('deflate')
    const buffer = await new Response(blobFrom(chunk.subarray(split + 2)).stream().pipeThrough(stream)).arrayBuffer()
    return new Uint8Array(buffer)
  } catch {
    return null
  }
}

function webpProfile(bytes: Uint8Array) {
  return webpChunk(bytes, 'ICCP')
}

function pngHasProfile(bytes: Uint8Array) {
  return pngChunk(bytes, 'iCCP') !== null || pngChunk(bytes, 'cICP') !== null
}

function embedJpeg(bytes: Uint8Array, profile: Uint8Array) {
  if (!isJpeg(bytes)) return null
  const segments: Uint8Array[] = []

  for (let offset = 0, index = 1; offset < profile.length; index++) {
    const piece = profile.subarray(offset, offset + JPEG_CHUNK)
    const segment = new Uint8Array(18 + piece.length)
    segment[0] = 0xff
    segment[1] = ICC_MARKER
    segment[2] = (segment.length - 2) >> 8
    segment[3] = (segment.length - 2) & 0xff
    segment.set(ICC_HEADER, 4)
    segment[16] = index
    segment[17] = 0
    segment.set(piece, 18)
    segments.push(segment)
    offset += piece.length
  }

  const count = segments.length
  for (const segment of segments) segment[17] = count

  const output = new Uint8Array(bytes.length + segments.reduce((sum, segment) => sum + segment.length, 0))
  output.set(bytes.subarray(0, 2), 0)
  let cursor = 2
  for (const segment of segments) {
    output.set(segment, cursor)
    cursor += segment.length
  }
  output.set(bytes.subarray(2), cursor)
  return output
}

async function embedPng(bytes: Uint8Array, profile: Uint8Array) {
  const chunks = readPng(bytes)
  if (!chunks) return null
  const kept = chunks.filter((chunk) => !PNG_DROP.has(chunk.id))
  const header = kept.findIndex((chunk) => chunk.id === 'IHDR')
  if (header < 0) return null

  let compressed: Uint8Array
  try {
    const stream = new CompressionStream('deflate')
    const buffer = await new Response(blobFrom(profile).stream().pipeThrough(stream)).arrayBuffer()
    compressed = new Uint8Array(buffer)
  } catch {
    return null
  }

  const name = new TextEncoder().encode('Display P3')
  const data = new Uint8Array(name.length + 2 + compressed.length)
  data.set(name, 0)
  data[name.length + 1] = 0
  data.set(compressed, name.length + 2)

  kept.splice(header + 1, 0, { id: 'iCCP', data })
  return writePng(kept)
}

function embedWebp(bytes: Uint8Array, profile: Uint8Array, width: number, height: number) {
  const chunks = readWebp(bytes)
  if (!chunks) return null

  const kept = chunks.filter((chunk) => chunk.id !== 'ICCP')
  const header = kept.find((chunk) => chunk.id === 'VP8X')
  if (header) {
    if (header.data.length < 1) return null
    header.data[0] |= 0x20
  } else {
    const alpha = kept.some((chunk) => chunk.id === 'ALPH' || (chunk.id === 'VP8L' && vp8lHasAlpha(chunk.data)))
    kept.unshift({ id: 'VP8X', data: vp8x(width, height, alpha) })
  }

  const headerAt = kept.findIndex((chunk) => chunk.id === 'VP8X')
  kept.splice(headerAt + 1, 0, { id: 'ICCP', data: profile })
  return writeWebp(kept)
}

function vp8x(width: number, height: number, alpha: boolean) {
  const data = new Uint8Array(10)
  data[0] = alpha ? 0x30 : 0x20
  writeU24(data, 4, Math.max(0, width - 1))
  writeU24(data, 7, Math.max(0, height - 1))
  return data
}

function vp8lHasAlpha(data: Uint8Array) {
  if (data.length < 5 || data[0] !== 0x2f) return false
  const bits = data[1] + (data[2] << 8) + (data[3] << 16) + data[4] * 0x1000000
  return ((bits >>> 28) & 1) === 1
}

function walkJpeg(bytes: Uint8Array, visit: (marker: number, payload: Uint8Array) => void) {
  if (!isJpeg(bytes)) return false
  let offset = 2

  while (offset + 1 < bytes.length) {
    if (bytes[offset] !== 0xff) return false
    let marker = bytes[offset + 1]
    offset += 2
    while (marker === 0xff) {
      if (offset >= bytes.length) return false
      marker = bytes[offset]
      offset += 1
    }
    if (marker === 0xd9) return true
    if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7)) continue
    if (offset + 2 > bytes.length) return false

    const length = (bytes[offset] << 8) | bytes[offset + 1]
    if (length < 2 || offset + length > bytes.length) return false
    visit(marker, bytes.subarray(offset + 2, offset + length))
    if (marker === JPEG_SCAN) return true
    offset += length
  }

  return true
}

function readPng(bytes: Uint8Array) {
  if (!isPng(bytes)) return null
  const chunks: Chunk[] = []
  let offset = 8

  while (offset + 12 <= bytes.length) {
    const length = readU32(bytes, offset)
    const end = offset + 12 + length
    if (length < 0 || end > bytes.length) return null
    chunks.push({
      id: latin1(bytes.subarray(offset + 4, offset + 8)),
      data: bytes.slice(offset + 8, offset + 8 + length),
    })
    offset = end
  }

  return chunks
}

function pngChunk(bytes: Uint8Array, id: string) {
  if (!isPng(bytes)) return null
  let offset = 8

  while (offset + 12 <= bytes.length) {
    const length = readU32(bytes, offset)
    const end = offset + 12 + length
    if (length < 0 || end > bytes.length) return null
    const type = latin1(bytes.subarray(offset + 4, offset + 8))
    if (type === id) return bytes.slice(offset + 8, offset + 8 + length)
    if (type === 'IDAT') return null
    offset = end
  }

  return null
}

function writePng(chunks: Chunk[]) {
  const size = 8 + chunks.reduce((sum, chunk) => sum + 12 + chunk.data.length, 0)
  const output = new Uint8Array(size)
  output.set(PNG_SIGNATURE, 0)
  let offset = 8

  for (const chunk of chunks) {
    writeU32(output, offset, chunk.data.length)
    output.set(new TextEncoder().encode(chunk.id), offset + 4)
    output.set(chunk.data, offset + 8)
    writeU32(output, offset + 8 + chunk.data.length, crc32(output.subarray(offset + 4, offset + 8 + chunk.data.length)))
    offset += 12 + chunk.data.length
  }

  return output
}

function readWebp(bytes: Uint8Array) {
  if (!isWebp(bytes)) return null
  const chunks: Chunk[] = []
  let offset = 12

  while (offset + 8 <= bytes.length) {
    const length = readU32LE(bytes, offset + 4)
    const end = offset + 8 + length
    if (end > bytes.length) return null
    chunks.push({
      id: latin1(bytes.subarray(offset, offset + 4)),
      data: bytes.slice(offset + 8, end),
    })
    offset = end + (length % 2)
  }

  return chunks
}

function webpChunk(bytes: Uint8Array, id: string) {
  if (!isWebp(bytes)) return null
  let offset = 12

  while (offset + 8 <= bytes.length) {
    const length = readU32LE(bytes, offset + 4)
    const end = offset + 8 + length
    if (end > bytes.length) return null
    if (latin1(bytes.subarray(offset, offset + 4)) === id) return bytes.slice(offset + 8, end)
    offset = end + (length % 2)
  }

  return null
}

function writeWebp(chunks: Chunk[]) {
  const body = chunks.reduce((sum, chunk) => sum + 8 + chunk.data.length + (chunk.data.length % 2), 0)
  const output = new Uint8Array(12 + body)
  output.set(new TextEncoder().encode('RIFF'), 0)
  writeU32LE(output, 4, 4 + body)
  output.set(new TextEncoder().encode('WEBP'), 8)
  let offset = 12

  for (const chunk of chunks) {
    output.set(new TextEncoder().encode(chunk.id), offset)
    writeU32LE(output, offset + 4, chunk.data.length)
    output.set(chunk.data, offset + 8)
    offset += 8 + chunk.data.length + (chunk.data.length % 2)
  }

  return output
}

function blobFrom(bytes: Uint8Array, type = '') {
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return new Blob([copy], type ? { type } : undefined)
}

function isJpeg(bytes: Uint8Array) {
  return bytes.length > 2 && bytes[0] === 0xff && bytes[1] === JPEG_START
}

function isPng(bytes: Uint8Array) {
  return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)
}

function isWebp(bytes: Uint8Array) {
  return bytes.length > 12 && latin1(bytes.subarray(0, 4)) === 'RIFF' && latin1(bytes.subarray(8, 12)) === 'WEBP'
}

function startsWith(bytes: Uint8Array, header: number[]) {
  return header.every((byte, index) => bytes[index] === byte)
}

function includesBytes(bytes: Uint8Array, needle: number[]) {
  if (needle.length === 0 || needle.length > bytes.length) return false
  for (let index = 0; index <= bytes.length - needle.length; index++) {
    if (needle.every((byte, offset) => bytes[index + offset] === byte)) return true
  }
  return false
}

function utf16le(bytes: number[]) {
  return bytes.flatMap((byte) => [byte, 0])
}

function utf16be(bytes: number[]) {
  return bytes.flatMap((byte) => [0, byte])
}

function concat(parts: Uint8Array[]) {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}

function latin1(bytes: Uint8Array) {
  return String.fromCharCode(...bytes)
}

function readU32(bytes: Uint8Array, offset: number) {
  return bytes[offset] * 0x1000000 + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3]
}

function writeU32(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = (value >>> 24) & 0xff
  bytes[offset + 1] = (value >>> 16) & 0xff
  bytes[offset + 2] = (value >>> 8) & 0xff
  bytes[offset + 3] = value & 0xff
}

function readU32LE(bytes: Uint8Array, offset: number) {
  return bytes[offset] + (bytes[offset + 1] << 8) + (bytes[offset + 2] << 16) + bytes[offset + 3] * 0x1000000
}

function writeU32LE(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = value & 0xff
  bytes[offset + 1] = (value >>> 8) & 0xff
  bytes[offset + 2] = (value >>> 16) & 0xff
  bytes[offset + 3] = (value >>> 24) & 0xff
}

function writeU24(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = value & 0xff
  bytes[offset + 1] = (value >>> 8) & 0xff
  bytes[offset + 2] = (value >>> 16) & 0xff
}

const CRC_TABLE = new Uint32Array(256).map((_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
