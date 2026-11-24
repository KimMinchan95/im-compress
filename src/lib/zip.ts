export interface ZipEntry {
  name: string
  blob: Blob
}

export async function zipStored(entries: ZipEntry[]) {
  const locals: ArrayBuffer[] = []
  const centrals: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const data = await entry.blob.arrayBuffer()
    const name = new TextEncoder().encode(entry.name.replace(/[\\/]/g, '-'))
    const checksum = crc32(new Uint8Array(data))
    const local = localHeader(name, checksum, data.byteLength)
    locals.push(local, data)
    centrals.push(centralHeader(name, checksum, data.byteLength, offset))
    offset += local.byteLength + data.byteLength
  }

  const directory = concat(centrals)
  const ending = endHeader(entries.length, directory.byteLength, offset)
  return new Blob([...locals, directory, ending], { type: 'application/zip' })
}

function localHeader(name: Uint8Array, checksum: number, size: number) {
  const bytes = new ArrayBuffer(30 + name.length)
  const view = new DataView(bytes)
  view.setUint32(0, 0x04034b50, true)
  view.setUint16(4, 20, true)
  view.setUint16(6, 0x0800, true)
  view.setUint16(8, 0, true)
  view.setUint16(10, 0, true)
  view.setUint16(12, 0, true)
  view.setUint32(14, checksum, true)
  view.setUint32(18, size, true)
  view.setUint32(22, size, true)
  view.setUint16(26, name.length, true)
  view.setUint16(28, 0, true)
  new Uint8Array(bytes).set(name, 30)
  return bytes
}

function centralHeader(name: Uint8Array, checksum: number, size: number, offset: number) {
  const bytes = new Uint8Array(46 + name.length)
  const view = new DataView(bytes.buffer)
  view.setUint32(0, 0x02014b50, true)
  view.setUint16(4, 20, true)
  view.setUint16(6, 20, true)
  view.setUint16(8, 0x0800, true)
  view.setUint16(10, 0, true)
  view.setUint16(12, 0, true)
  view.setUint16(14, 0, true)
  view.setUint32(16, checksum, true)
  view.setUint32(20, size, true)
  view.setUint32(24, size, true)
  view.setUint16(28, name.length, true)
  view.setUint16(30, 0, true)
  view.setUint16(32, 0, true)
  view.setUint16(34, 0, true)
  view.setUint16(36, 0, true)
  view.setUint32(38, 0, true)
  view.setUint32(42, offset, true)
  bytes.set(name, 46)
  return bytes
}

function endHeader(count: number, directorySize: number, directoryOffset: number) {
  const bytes = new ArrayBuffer(22)
  const view = new DataView(bytes)
  view.setUint32(0, 0x06054b50, true)
  view.setUint16(4, 0, true)
  view.setUint16(6, 0, true)
  view.setUint16(8, count, true)
  view.setUint16(10, count, true)
  view.setUint32(12, directorySize, true)
  view.setUint32(16, directoryOffset, true)
  view.setUint16(20, 0, true)
  return bytes
}

function concat(parts: Uint8Array[]) {
  const bytes = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) {
    bytes.set(part, offset)
    offset += part.length
  }
  return bytes
}

const CRC_TABLE = new Uint32Array(256).map((_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
