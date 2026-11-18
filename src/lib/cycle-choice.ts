export function cycleChoice<T>(current: T, clicked: T, order: readonly T[]): T {
  if (!Object.is(current, clicked)) return clicked
  const index = order.indexOf(current)
  if (index < 0) return clicked
  const next = order[(index + 1) % order.length]
  return next === undefined ? clicked : next
}
