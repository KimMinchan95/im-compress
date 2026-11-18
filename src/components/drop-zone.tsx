import { useEditorStore } from '../store/editor-store'
import type { EditorErrorCode } from '../types'
import { useI18n } from '../lib/use-i18n'

const ACCEPT = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp'
const FORMATS = ['JPG', 'PNG', 'WebP']

export function DropZone() {
  const error = useEditorStore((state) => state.error)
  const isReading = useEditorStore((state) => state.isReading)
  const loadFile = useEditorStore((state) => state.loadFile)
  const { t } = useI18n()

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-5 py-8">
      <div className="orb orb-a" />
      <div className="orb orb-b" />
      <div className="orb orb-c" />
      <div className="relative z-10 grid w-full max-w-6xl items-center gap-8 md:grid-cols-[1.05fr_0.95fr]">
        <div className="text-center md:text-left">
          <p className="rise flex items-center justify-center gap-2 text-xs font-semibold tracking-[0.22em] text-accent md:justify-start">
            <span className="brand-dot inline-block h-2 w-2 rounded-full bg-accent" />
            {t('eyebrow')}
          </p>
          <h1 className="hero-sheen rise mt-4 text-4xl font-semibold tracking-tight sm:text-5xl xl:text-7xl" style={{ animationDelay: '80ms' }}>
            {t('heroTitle')}
          </h1>
          <p className="rise mx-auto mt-4 max-w-xl text-base text-muted md:mx-0" style={{ animationDelay: '150ms' }}>
            {t('heroBody')}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2 md:justify-start">
            {FORMATS.map((label, index) => (
              <span
                key={label}
                className="rise rounded-full bg-sunken px-3 py-1.5 text-sm font-semibold ring-1 ring-line"
                style={{ animationDelay: `${220 + index * 70}ms` }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-center gap-5">
          <CompareShowcase original={t('original')} compressed={t('compressed')} />
          <div className="drop-shell rise w-full max-w-md" style={{ animationDelay: '260ms' }}>
            <div className="drop-spin" aria-hidden="true" />
            <label className="drop-face">
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
              <span className={`grid h-16 w-16 place-items-center rounded-2xl bg-accent text-3xl font-semibold text-on-accent ${isReading ? 'animate-pulse' : 'bob'}`}>
                +
              </span>
              <span className="mt-6 text-2xl font-semibold">{isReading ? t('dropReading') : t('dropTitle')}</span>
              <span className="mt-2 text-sm text-muted">{t('dropHint')}</span>
            </label>
          </div>
        </div>
      </div>
      {error ? <p className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-sm text-accent">{errorText(t, error)}</p> : null}
    </main>
  )
}

function CompareShowcase({ original, compressed }: { original: string; compressed: string }) {
  return (
    <div className="showcase rise" style={{ animationDelay: '140ms' }} aria-hidden="true">
      <div className="showcase-photo">
        <div className="showcase-base" />
        <div className="showcase-top" />
        <div className="showcase-bar" />
        <span className="showcase-chip showcase-chip-a">
          {original} · 2.4 MB
        </span>
        <span className="showcase-chip showcase-chip-b">
          {compressed} · 180 KB
        </span>
      </div>
    </div>
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
