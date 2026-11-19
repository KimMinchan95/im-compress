let current = null

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('message', (event) => {
  const data = event.data
  if (!data || data.type !== 'file') return
  const allowed = data.mime === 'image/jpeg' || data.mime === 'image/png' || data.mime === 'image/webp'
  if (!allowed || !data.buffer) {
    event.ports[0]?.postMessage({ ok: false })
    return
  }
  current = { mime: data.mime, buffer: data.buffer }
  event.ports[0]?.postMessage({ ok: true })
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (!url.pathname.endsWith('/__download')) return

  if (!current) {
    event.respondWith(new Response('', { status: 404 }))
    return
  }

  const filename = url.searchParams.get('name') || 'image'
  const fallback = filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_') || 'image'
  event.respondWith(
    new Response(current.buffer.slice(0), {
      headers: {
        'Content-Type': current.mime,
        'Content-Disposition': `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    }),
  )
})
