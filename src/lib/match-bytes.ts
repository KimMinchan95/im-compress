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

/**
 * Lowest quality the size search will use before it starts shrinking the image instead.
 * Below this, artefacts become clearly visible, while a modest resize is usually less noticeable.
 */
const QUALITY_FLOOR = 40
const SCALE_STEPS = 8

/**
 * Finds the best encode that fits within `targetBytes`.
 *
 * 1. Keep full resolution and search for the highest quality (never above the user's quality)
 *    that fits. Quality loss is the least visible way to save bytes.
 * 2. Only if even `QUALITY_FLOOR` does not fit, search for the largest resolution that fits at
 *    that quality.
 *
 * If nothing fits, the smallest candidate found is returned.
 */
export async function matchBytes(
  encode: (attempt: EncodeAttempt) => Promise<Blob>,
  input: MatchInput,
): Promise<Candidate> {
  const target = Math.max(1, Math.round(input.targetBytes))
  const ceiling = clampQuality(input.quality)
  const floor = Math.min(QUALITY_FLOOR, ceiling)
  const fullSize = sizeFromScale(input.sourceWidth, input.sourceHeight, 100)

  const ceilingAttempt = await attempt(encode, { quality: ceiling, ...fullSize })
  if (ceilingAttempt.bytes <= target) return ceilingAttempt

  const byQuality = await searchQuality(encode, fullSize, floor, ceiling - 1, target)
  if (byQuality) return byQuality

  return searchScale(encode, input, floor, target)
}

/**
 * Binary search for the highest quality in [low, high] whose output fits `target`.
 * Size grows with quality, so every fitting result raises the lower bound.
 */
async function searchQuality(
  encode: (attempt: EncodeAttempt) => Promise<Blob>,
  size: Omit<EncodeAttempt, 'quality'>,
  low: number,
  high: number,
  target: number,
): Promise<Candidate | null> {
  let best: Candidate | null = null
  let lo = low
  let hi = high

  while (lo <= hi) {
    const quality = Math.floor((lo + hi) / 2)
    const candidate = await attempt(encode, { quality, ...size })
    if (candidate.bytes <= target) {
      best = candidate
      lo = quality + 1
    } else {
      hi = quality - 1
    }
  }

  return best
}

/**
 * Binary search for the largest scale in [1, 100] (percent of the source) that fits `target`
 * at a fixed quality. Used only when quality alone cannot reach the target.
 */
async function searchScale(
  encode: (attempt: EncodeAttempt) => Promise<Blob>,
  input: MatchInput,
  quality: number,
  target: number,
): Promise<Candidate> {
  let best: Candidate | null = null
  let smallest: Candidate | null = null
  let lo = 1
  let hi = 100

  for (let step = 0; lo <= hi && step < SCALE_STEPS; step += 1) {
    const scale = Math.floor((lo + hi) / 2)
    const size = sizeFromScale(input.sourceWidth, input.sourceHeight, scale)
    const candidate = await attempt(encode, { quality, ...size })
    if (!smallest || candidate.bytes < smallest.bytes) smallest = candidate

    if (candidate.bytes <= target) {
      best = candidate
      lo = scale + 1
    } else {
      hi = scale - 1
    }
  }

  const result = best ?? smallest
  if (!result) throw new Error('encode')
  return result
}

async function attempt(
  encode: (attempt: EncodeAttempt) => Promise<Blob>,
  input: EncodeAttempt,
): Promise<Candidate> {
  const blob = await encode(input)
  return { ...input, blob, bytes: blob.size }
}

function clampQuality(quality: number) {
  return Math.min(100, Math.max(1, Math.round(quality)))
}
