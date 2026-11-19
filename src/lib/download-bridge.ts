const WORKER_VERSION = '5'

let ready = false
let token = 0
let lastFile: { blob: Blob; mime: string } | null = null

function workerScript() {
  return `${import.meta.env.BASE_URL}download-sw.js?v=${WORKER_VERSION}`
}

function isDownloadWorker(scriptUrl: string) {
  return scriptUrl.includes('download-sw.js')
}

function isCurrentWorker(scriptUrl: string) {
  return isDownloadWorker(scriptUrl) && scriptUrl.includes(`v=${WORKER_VERSION}`)
}

export function registerDownloadBridge() {
  if (!('serviceWorker' in navigator)) return
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    ready = false
    if (!lastFile) return
    void publishDownload(lastFile.blob, lastFile.mime)
  })
  void replaceDownloadWorker()
}

async function replaceDownloadWorker() {
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
  await navigator.serviceWorker.register(workerScript())
}

function whenControlled() {
  if (navigator.serviceWorker.controller) return Promise.resolve()
  return new Promise<void>((resolve) => {
    const timer = window.setTimeout(resolve, 4000)
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      () => {
        window.clearTimeout(timer)
        resolve()
      },
      { once: true },
    )
  })
}

export async function publishDownload(blob: Blob, mime: string) {
  const current = ++token
  lastFile = { blob, mime }
  if (!('serviceWorker' in navigator)) return

  const finished = (async () => {
    try {
      await navigator.serviceWorker.ready
      if (current !== token) return
      if (!navigator.serviceWorker.controller) await whenControlled()
      const worker = navigator.serviceWorker.controller
      if (!worker || current !== token || !isCurrentWorker(worker.scriptURL)) return
      const buffer = await blob.arrayBuffer()
      if (current !== token) return
      await new Promise<void>((resolve, reject) => {
        const channel = new MessageChannel()
        const timer = window.setTimeout(() => reject(new Error('timeout')), 4000)
        channel.port1.onmessage = (event: MessageEvent<{ ok?: boolean }>) => {
          window.clearTimeout(timer)
          if (event.data?.ok) resolve()
          else reject(new Error('rejected'))
        }
        worker.postMessage({ type: 'file', mime, buffer }, [channel.port2])
      })
      if (current === token && navigator.serviceWorker.controller === worker) ready = true
    } catch {
      if (current === token) ready = false
    }
  })()

  await Promise.race([finished, new Promise((resolve) => window.setTimeout(resolve, 4000))])
}

export function directDownloadUrl(filename: string) {
  const worker = navigator.serviceWorker?.controller
  if (!ready || !worker || !isCurrentWorker(worker.scriptURL)) return null
  return `${import.meta.env.BASE_URL}__download?${new URLSearchParams({ name: filename })}`
}
