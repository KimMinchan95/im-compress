export async function decodeHeic(file: Blob) {
  const { heicTo } = await import('heic-to')
  return heicTo({ blob: file, type: 'image/png' })
}
