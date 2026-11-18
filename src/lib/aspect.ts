export const MIN_EDGE = 1
export const MAX_EDGE = 8192

export interface PixelSize {
  width: number
  height: number
  scale: number
}

function scaleFromWidth(width: number, originalWidth: number) {
  return Math.round((width / originalWidth) * 1000) / 10
}

function clampRequest(value: number) {
  if (!Number.isFinite(value)) return MIN_EDGE
  return Math.min(MAX_EDGE, Math.max(MIN_EDGE, Math.round(value)))
}

export function sizeFromWidth(
  originalWidth: number,
  originalHeight: number,
  width: number,
): PixelSize {
  let nextWidth = clampRequest(width)
  let nextHeight = Math.round((nextWidth * originalHeight) / originalWidth)

  if (nextHeight > MAX_EDGE) {
    nextWidth = Math.max(MIN_EDGE, Math.floor((originalWidth * MAX_EDGE) / originalHeight))
    nextHeight = Math.round((nextWidth * originalHeight) / originalWidth)
  }

  if (nextHeight < MIN_EDGE) {
    nextWidth = Math.min(MAX_EDGE, Math.max(MIN_EDGE, Math.ceil(originalWidth / originalHeight)))
    nextHeight = Math.round((nextWidth * originalHeight) / originalWidth)
  }

  while (nextHeight > MAX_EDGE && nextWidth > MIN_EDGE) {
    nextWidth -= 1
    nextHeight = Math.round((nextWidth * originalHeight) / originalWidth)
  }

  while (nextHeight < MIN_EDGE && nextWidth < MAX_EDGE) {
    nextWidth += 1
    nextHeight = Math.round((nextWidth * originalHeight) / originalWidth)
  }

  nextHeight = Math.min(MAX_EDGE, Math.max(MIN_EDGE, nextHeight))

  return {
    width: nextWidth,
    height: nextHeight,
    scale: scaleFromWidth(nextWidth, originalWidth),
  }
}

export function sizeFromHeight(
  originalWidth: number,
  originalHeight: number,
  height: number,
): PixelSize {
  let nextHeight = clampRequest(height)
  let nextWidth = Math.round((nextHeight * originalWidth) / originalHeight)

  if (nextWidth > MAX_EDGE) {
    nextHeight = Math.max(MIN_EDGE, Math.floor((originalHeight * MAX_EDGE) / originalWidth))
    nextWidth = Math.round((nextHeight * originalWidth) / originalHeight)
  }

  if (nextWidth < MIN_EDGE) {
    nextHeight = Math.min(MAX_EDGE, Math.max(MIN_EDGE, Math.ceil(originalHeight / originalWidth)))
    nextWidth = Math.round((nextHeight * originalWidth) / originalHeight)
  }

  while (nextWidth > MAX_EDGE && nextHeight > MIN_EDGE) {
    nextHeight -= 1
    nextWidth = Math.round((nextHeight * originalWidth) / originalHeight)
  }

  while (nextWidth < MIN_EDGE && nextHeight < MAX_EDGE) {
    nextHeight += 1
    nextWidth = Math.round((nextHeight * originalWidth) / originalHeight)
  }

  nextWidth = Math.min(MAX_EDGE, Math.max(MIN_EDGE, nextWidth))

  return {
    width: nextWidth,
    height: nextHeight,
    scale: scaleFromWidth(nextWidth, originalWidth),
  }
}

export function sizeFromScale(
  originalWidth: number,
  originalHeight: number,
  scale: number,
): PixelSize {
  const width = Math.round((originalWidth * scale) / 100)
  return sizeFromWidth(originalWidth, originalHeight, width)
}
