export type ByteUnit = 'kb' | 'mb'

const UNIT_BYTES: Record<ByteUnit, number> = {
  kb: 1024,
  mb: 1024 * 1024,
}

export function byteFieldValue(bytes: number, unit: ByteUnit) {
  const unitBytes = UNIT_BYTES[unit]
  if (unit === 'mb') return Math.round((bytes / unitBytes) * 1000) / 1000
  return Math.max(1, Math.round(bytes / unitBytes))
}

export function targetFromField(
  value: number,
  unit: ByteUnit,
  currentTarget: number | null,
  outputBytes: number,
) {
  const bytes = Math.round(value * UNIT_BYTES[unit])
  const tolerance = unit === 'mb' ? 512 : 1024
  if (value <= 0 || bytes < 1) return null
  if (currentTarget != null && Math.abs(bytes - currentTarget) <= tolerance) return undefined
  if (currentTarget == null && Math.abs(bytes - outputBytes) <= tolerance) return undefined
  return bytes
}
