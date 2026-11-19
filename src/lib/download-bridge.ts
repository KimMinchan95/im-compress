const WORKER_VERSION = '7'

const readyIds = new Set<string>()
let lastFile: { id: string; blob: Blob; mime: string } | null = null
let replacing: Promise<void> | null = null

function workerScript() {
  return `${import.meta.env.BASE_URL}download-sw.js?v=${WORKER_VERSION}`
}

function isDownloadWorker(scriptUrl: string) {
  return scriptUrl.includes('download-sw.js')
}

function workerVersion(scriptUrl: string) {
  try {
    return new URL(scriptUrl).searchParams.get('v')
  } catch {
    return null
  }
}

function isCurrentWorker(scriptUrl: string) {
  return isDownloadWorker(scriptUrl) && workerVersion(scriptUrl) === WORKER_VERSION
}

export function registerDownloadBridge() {
  if (!('serviceWorker' in navigator)) return
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!lastFile) return
    void publishDownload(lastFile.id, lastFile.blob, lastFile.mime)
  })
  void replaceDownloadWorker().catch(() => undefined)
}

function replaceDownloadWorker() {
  if (!replacing) {
    replacing = replaceDownloadWorkerOnce().finally(() => {
      replacing = null
    })
  }
  return replacing
}

async function replaceDownloadWorkerOnce() {
  const registrations = await navigator.serviceWorker.getRegistrations()
  await Promise.all(
    registrations.map((registration) => {
      const scripts = [registration.active, registration.waiting, registration.installing]
        .map((worker) => worker?.scriptURL ?? '')
        .filter(Boolean)
      if (scripts.length === 0 || scripts.every((script) => !isDownloadWorker(script))) return Promise.resolve(false)
      if (scripts.some((script) => isCurrentWorker(script))) return Promise.resolve(false)
      return registration.unregister()
    }),
  )
  const registration = await navigator.serviceWorker.register(workerScript())
  await registration.update().catch(() => undefined)
}

function whenCurrentController() {
  const current = navigator.serviceWorker.controller
  if (current && isCurrentWorker(current.scriptURL)) return Promise.resolve(current)
  return new Promise<ServiceWorker | null>((resolve) => {
    const onChange = () => {
      window.clearTimeout(timer)
      resolve(navigator.serviceWorker.controller)
    }
    const timer = window.setTimeout(() => {
      navigator.serviceWorker.removeEventListener('controllerchange', onChange)
      resolve(navigator.serviceWorker.controller)
    }, 8000)
    navigator.serviceWorker.addEventListener('controllerchange', onChange)
  })
}

export function createDownloadId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function rememberReady(id: string) {
  readyIds.add(id)
}

function postFile(worker: ServiceWorker, id: string, mime: string, buffer: ArrayBuffer) {
  return new Promise<boolean>((resolve) => {
    let settled = false
    const finish = (accepted: boolean) => {
      if (accepted) rememberReady(id)
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      resolve(accepted)
    }
    const channel = new MessageChannel()
    const timer = window.setTimeout(() => finish(false), 8000)
    channel.port1.onmessage = (event: MessageEvent<{ ok?: boolean; id?: string }>) => {
      finish(Boolean(event.data?.ok && event.data.id === id))
    }
    try {
      worker.postMessage({ type: 'file', id, mime, buffer }, [buffer, channel.port2])
    } catch {
      finish(false)
    }
  })
}

export async function publishDownload(id: string, blob: Blob, mime: string) {
  lastFile = { id, blob, mime }
  if (!('serviceWorker' in navigator)) return false

  const attempt = (async () => {
    const controller = navigator.serviceWorker.controller
    if (!controller || !isCurrentWorker(controller.scriptURL)) await replaceDownloadWorker()
    const registration = await navigator.serviceWorker.ready
    const active = registration.active
    if (!navigator.serviceWorker.controller && active && isCurrentWorker(active.scriptURL)) {
      active.postMessage({ type: 'claim' })
    }
    let worker = navigator.serviceWorker.controller
    if (!worker || !isCurrentWorker(worker.scriptURL)) worker = await whenCurrentController()
    if (!worker || !isCurrentWorker(worker.scriptURL)) return false
    const buffer = await blob.arrayBuffer()
    return postFile(worker, id, mime, buffer)
  })().catch(() => false)

  return Promise.race([
    attempt,
    new Promise<boolean>((resolve) => window.setTimeout(() => resolve(false), 8000)),
  ])
}

export function directDownloadUrl(id: string | null, filename: string) {
  if (!id || !readyIds.has(id) || !('serviceWorker' in navigator)) return null
  const params = new URLSearchParams({ id, name: filename })
  return `${import.meta.env.BASE_URL}__download?${params}`
}
