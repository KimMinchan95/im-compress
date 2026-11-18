export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) {
    const value = bytes / 1024
    return `${value.toFixed(value < 10 ? 1 : 0)} KB`
  }
  const value = bytes / (1024 * 1024)
  return `${value.toFixed(value < 10 ? 2 : 1)} MB`
}

export type Savings =
  | { kind: 'same' }
  | { kind: 'smaller'; percent: number }
  | { kind: 'larger'; percent: number }

export function savingsOf(original: number, next: number): Savings {
  if (original <= 0) return { kind: 'same' }
  const delta = next - original
  if (delta === 0) return { kind: 'same' }
  const percent = Math.round((Math.abs(delta) / original) * 100)
  if (delta < 0) return { kind: 'smaller', percent }
  return { kind: 'larger', percent }
}
