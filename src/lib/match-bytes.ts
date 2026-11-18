import { sizeFromScale } from './aspect'

export interface EncodeAttempt {
  quality: number
  width: number
  height: number
  scale: number
}

interface MatchInput {
  sourceWidth: number
  sourceHeight: number
  quality: number
  targetBytes: number
}

interface Candidate extends EncodeAttempt {
  blob: Blob
  bytes: number
}

function prefer(current: Candidate | null, next: Candidate, target: number) {
  if (!current) return next
  const currentUnder = current.bytes <= target
  const nextUnder = next.bytes <= target
  if (nextUnder !== currentUnder) return nextUnder ? next : current
  if (nextUnder) return next.bytes >= current.bytes ? next : current
  return next.bytes <= current.bytes ? next : current
}

export async function matchBytes(
  encode: (attempt: EncodeAttempt) => Promise<Blob>,
  input: MatchInput,
): Promise<Candidate> {
  const target = Math.max(1, Math.round(input.targetBytes))
  let low = 1
  let high = 100
  let best: Candidate | null = null
  let steps = 0

  while (low <= high && steps < 8) {
    const scale = Math.round((low + high) / 2)
    const sized = sizeFromScale(input.sourceWidth, input.sourceHeight, scale)
    const blob = await encode({
      quality: input.quality,
      width: sized.width,
      height: sized.height,
      scale: sized.scale,
    })
    const candidate: Candidate = {
      blob,
      quality: input.quality,
      width: sized.width,
      height: sized.height,
      scale: sized.scale,
      bytes: blob.size,
    }
    best = prefer(best, candidate, target)
    steps += 1
    if (candidate.bytes > target) high = scale - 1
    else low = scale + 1
  }

  if (!best) throw new Error('encode')
  return best
}
