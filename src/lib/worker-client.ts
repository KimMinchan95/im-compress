import type { EncodeResponse } from '../types'

export interface WorkerClient<Task extends object> {
  /** Runs one task on the shared worker and resolves with the produced blob. */
  run: (task: Task) => Promise<Blob>
  /** Rejects every in-flight task with `cancelled` and terminates the worker. */
  cancel: () => void
}

interface Pending {
  resolve: (blob: Blob) => void
  reject: (error: Error) => void
}

/**
 * A long-lived worker with request ids.
 *
 * Creating a worker per attempt re-instantiated every WASM codec and re-decoded the source each
 * time. Keeping one worker alive lets the attempts of a size search reuse everything. The worker
 * is only terminated when work is actually cancelled (settings changed or the view left), or
 * when it crashes; the next task then starts a fresh one.
 *
 * @param createWorker Factory for the worker. Must use a literal `new URL(..., import.meta.url)`
 *   so that the bundler emits the worker file.
 */
export function createWorkerClient<Task extends object>(createWorker: () => Worker): WorkerClient<Task> {
  let worker: Worker | null = null
  let nextId = 1
  const pending = new Map<number, Pending>()

  function rejectAll(error: Error) {
    for (const entry of pending.values()) entry.reject(error)
    pending.clear()
  }

  function ensureWorker() {
    if (worker) return worker

    const next = createWorker()
    next.onmessage = (event: MessageEvent<EncodeResponse>) => {
      const entry = pending.get(event.data.id)
      if (!entry) return
      pending.delete(event.data.id)
      if (event.data.blob) entry.resolve(event.data.blob)
      else entry.reject(new Error(event.data.error ?? 'encode'))
    }
    next.onerror = () => {
      rejectAll(new Error('encode'))
      next.terminate()
      if (worker === next) worker = null
    }
    worker = next
    return next
  }

  return {
    run(task) {
      const target = ensureWorker()
      const id = nextId++
      return new Promise<Blob>((resolve, reject) => {
        pending.set(id, { resolve, reject })
        target.postMessage({ id, ...task })
      })
    },
    cancel() {
      rejectAll(new Error('cancelled'))
      worker?.terminate()
      worker = null
    },
  }
}
