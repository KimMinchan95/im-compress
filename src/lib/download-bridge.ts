let ready = false
let token = 0

export function registerDownloadBridge() {
  if (!('serviceWorker' in navigator)) return
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    ready = false
  })
  void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}download-sw.js`)
}

function whenControlled() {
  if (navigator.serviceWorker.controller) return Promise.resolve()
  return new Promise<void>((resolve) => {
    const timer = window.setTimeout(resolve, 2000)
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
  ready = false
  if (!('serviceWorker' in navigator)) return

  const finished = (async () => {
    try {
      const registration = await navigator.serviceWorker.ready
      const worker = registration.active
      if (!worker || current !== token) return
      await whenControlled()
      if (!navigator.serviceWorker.controller || current !== token) return
      const buffer = await blob.arrayBuffer()
      if (current !== token) return
      await new Promise<void>((resolve, reject) => {
        const channel = new MessageChannel()
        const timer = window.setTimeout(() => reject(new Error('timeout')), 2000)
        channel.port1.onmessage = () => {
          window.clearTimeout(timer)
          resolve()
        }
        worker.postMessage({ type: 'file', mime, buffer }, [channel.port2])
      })
      if (current === token) ready = true
    } catch {
      if (current === token) ready = false
    }
  })()

  await Promise.race([finished, new Promise((resolve) => window.setTimeout(resolve, 2000))])
}

export function directDownloadUrl(filename: string) {
  if (!ready || !navigator.serviceWorker?.controller) return null
  return `${import.meta.env.BASE_URL}__download?${new URLSearchParams({ name: filename })}`
}
