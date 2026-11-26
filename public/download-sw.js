const CACHE_NAME = 'im-compress-downloads'
const KEEP_FILES = 24
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

function isDownloadId(id) {
  return typeof id === 'string' && ID_PATTERN.test(id)
}

function fileRequest(id) {
  return new Request(new URL(`download-file/${id}`, self.registration.scope).href)
}

function contentDisposition(filename) {
  const safe = String(filename || 'image').replace(/[\r\n]/g, '').slice(0, 180) || 'image'
  const fallback = safe.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_') || 'image'
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(safe)}`
}

function stayOnPage() {
  return new Response(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store' },
  })
}

async function trimCache(cache, keepId) {
  const requests = await cache.keys()
  if (requests.length <= KEEP_FILES) return
  const entries = []
  for (const request of requests) {
    const response = await cache.match(request)
    entries.push({
      request,
      storedAt: Number(response?.headers.get('X-Stored-At') || 0),
      pinned: request.url.endsWith(`/${keepId}`),
    })
  }
  entries.sort((left, right) => left.storedAt - right.storedAt || Number(left.pinned) - Number(right.pinned))
  let extra = entries.length - KEEP_FILES
  for (const entry of entries) {
    if (extra <= 0) break
    if (entry.pinned) continue
    await cache.delete(entry.request)
    extra -= 1
  }
}

async function storeFile(data) {
  if (!isDownloadId(data.id) || !ALLOWED_MIME.has(data.mime)) return false
  if (!(data.blob instanceof Blob) || data.blob.size < 1) return false
  const cache = await caches.open(CACHE_NAME)
  await cache.put(
    fileRequest(data.id),
    new Response(data.blob, {
      headers: {
        'Content-Type': data.mime,
        'X-Stored-At': String(Date.now()),
      },
    }),
  )
  await trimCache(cache, data.id).catch(() => undefined)
  return true
}

function reply(port, message) {
  try {
    port?.postMessage(message)
  } catch {
    // The page may already be gone.
  }
}

self.addEventListener('message', (event) => {
  const data = event.data
  if (!data) return
  if (data.type === 'claim') {
    event.waitUntil(self.clients.claim())
    return
  }
  if (data.type !== 'file') return
  const port = event.ports[0]
  const task = storeFile(data).then(
    (ok) => reply(port, ok ? { ok: true, id: data.id } : { ok: false }),
    () => reply(port, { ok: false }),
  )
  event.waitUntil(task)
})

async function serveDownload(url) {
  try {
    const id = url.searchParams.get('id') || ''
    if (!isDownloadId(id)) return stayOnPage()
    const cache = await caches.open(CACHE_NAME)
    const cached = await cache.match(fileRequest(id))
    if (!cached) return stayOnPage()
    const mime = cached.headers.get('Content-Type') || ''
    if (!ALLOWED_MIME.has(mime)) return stayOnPage()
    const body = await cached.arrayBuffer()
    if (body.byteLength < 1) return stayOnPage()
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Content-Disposition': contentDisposition(url.searchParams.get('name') || 'image'),
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return stayOnPage()
  }
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (!url.pathname.endsWith('/__download')) return
  event.respondWith(serveDownload(url))
})
