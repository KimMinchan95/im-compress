import { useEditorStore } from '../store/editor-store'
import type { EditorErrorCode } from '../types'
import { useI18n } from '../lib/use-i18n'

const ACCEPT = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp'

export function DropZone() {
  const error = useEditorStore((state) => state.error)
  const isReading = useEditorStore((state) => state.isReading)
  const loadFile = useEditorStore((state) => state.loadFile)
  const { t } = useI18n()

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-5 pb-20">
      <div className="mb-10 max-w-xl text-center">
        <p className="text-xs font-semibold tracking-[0.22em] text-accent">{t('eyebrow')}</p>
        <h1 className="mt-3 text-5xl font-semibold tracking-tight md:text-7xl">{t('heroTitle')}</h1>
        <p className="mt-4 text-base text-muted">{t('heroBody')}</p>
      </div>
      <label className="flex w-full max-w-xl cursor-pointer flex-col items-center rounded-[32px] border border-dashed border-line bg-panel px-8 py-16 text-center transition hover:border-accent/80">
        <input
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.currentTarget.value = ''
            if (file) void loadFile(file)
          }}
        />
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-accent text-3xl font-semibold text-on-accent">
          +
        </span>
        <span className="mt-6 text-2xl font-semibold">{isReading ? t('dropReading') : t('dropTitle')}</span>
        <span className="mt-2 text-sm text-muted">{t('dropHint')}</span>
      </label>
      {error ? <p className="mt-5 text-sm text-accent">{errorText(t, error)}</p> : null}
    </main>
  )
}

export function errorText(
  t: ReturnType<typeof useI18n>['t'],
  error: EditorErrorCode,
) {
  if (error === 'unsupported') return t('unsupported')
  if (error === 'unreadable') return t('unreadable')
  return t('encodeFailed')
}

export { ACCEPT }
