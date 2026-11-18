import { useEffect, useRef, useState } from 'react'
import { Controls } from './components/controls'
import { ACCEPT, DropZone } from './components/drop-zone'
import { Preview } from './components/preview'
import { ExitIcon, MoonIcon, SunIcon } from './components/icons'
import { useI18n } from './lib/use-i18n'
import { useEncoder } from './lib/use-encoder'
import { useHydrated, useResolvedTheme } from './lib/use-theme'
import { useEditorStore } from './store/editor-store'
import { usePreferences } from './store/preferences-store'

function hasFileDrop(types: DataTransfer['types']) {
  return Array.from(types).includes('Files')
}

function EncodeBridge() {
  useEncoder()
  return null
}

function ThemeSync() {
  const locale = usePreferences((state) => state.locale)
  const resolved = useResolvedTheme()
  const hydrated = useHydrated()

  useEffect(() => {
    if (!hydrated) return
    document.documentElement.dataset.theme = resolved
    document.documentElement.lang = locale
    document.title = locale === 'ko' ? '이미지 압축' : 'Compress'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'light' ? '#f3efe7' : '#100f0d')
  }, [hydrated, locale, resolved])

  return null
}

function Header() {
  const hasSource = useEditorStore((state) => state.source !== null)
  const loadFile = useEditorStore((state) => state.loadFile)
  const leave = useEditorStore((state) => state.leave)
  const locale = usePreferences((state) => state.locale)
  const setTheme = usePreferences((state) => state.setTheme)
  const setLocale = usePreferences((state) => state.setLocale)
  const resolved = useResolvedTheme()
  const { t } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const nextLocale = locale === 'ko' ? 'en' : 'ko'

  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-5 py-4 md:px-8">
      <div className="flex items-center gap-2.5">
        {hasSource ? (
          <button
            type="button"
            aria-label={t('leave')}
            onClick={leave}
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-muted transition duration-200 hover:bg-sunken hover:text-cream active:scale-95"
          >
            <ExitIcon className="h-4 w-4" />
          </button>
        ) : null}
        <span className="brand-dot inline-block h-2.5 w-2.5 rounded-full bg-accent" />
        <span className="text-sm font-semibold tracking-[0.2em]">{t('brand')}</span>
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
        <p className="hidden text-right text-xs leading-5 text-muted sm:block">{t('stayLocal')}</p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            aria-label={resolved === 'dark' ? t('themeToLight') : t('themeToDark')}
            onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
            className="grid h-10 w-10 cursor-pointer place-items-center rounded-full bg-sunken text-cream ring-1 ring-line transition duration-200 hover:scale-105 active:scale-95"
          >
            <span key={resolved} className="icon-pop grid place-items-center">
              {resolved === 'dark' ? <SunIcon /> : <MoonIcon />}
            </span>
          </button>
          <button
            type="button"
            aria-label={t('language')}
            onClick={() => setLocale(nextLocale)}
            className="relative grid h-10 cursor-pointer grid-cols-2 items-center rounded-full bg-sunken p-1 ring-1 ring-line"
          >
            <span
              className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-cream transition-transform duration-300 ease-out"
              style={{ transform: locale === 'en' ? 'translateX(100%)' : 'translateX(0)' }}
            />
            <span className={`relative z-10 px-3 text-sm font-semibold transition-colors duration-300 ${locale === 'ko' ? 'text-ink' : 'text-muted'}`}>
              한글
            </span>
            <span className={`relative z-10 px-3 text-sm font-semibold transition-colors duration-300 ${locale === 'en' ? 'text-ink' : 'text-muted'}`}>
              EN
            </span>
          </button>
          {hasSource ? (
            <>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="h-10 cursor-pointer rounded-full bg-sunken px-4 text-sm ring-1 ring-line"
              >
                {t('changeImage')}
              </button>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.currentTarget.value = ''
                  if (file) void loadFile(file)
                }}
              />
            </>
          ) : null}
        </div>
      </div>
    </header>
  )
}

export default function App() {
  const hasSource = useEditorStore((state) => state.source !== null)
  const loadFile = useEditorStore((state) => state.loadFile)
  const { t } = useI18n()
  const [isDragging, setIsDragging] = useState(false)
  const depth = useRef(0)

  return (
    <div
      className="relative min-h-dvh overflow-x-hidden bg-ink font-sans text-cream"
      onDragEnter={(event) => {
        if (!hasFileDrop(event.dataTransfer.types)) return
        event.preventDefault()
        depth.current += 1
        setIsDragging(true)
      }}
      onDragOver={(event) => {
        if (!hasFileDrop(event.dataTransfer.types)) return
        event.preventDefault()
      }}
      onDragLeave={() => {
        depth.current -= 1
        if (depth.current <= 0) {
          depth.current = 0
          setIsDragging(false)
        }
      }}
      onDrop={(event) => {
        if (!hasFileDrop(event.dataTransfer.types)) return
        event.preventDefault()
        depth.current = 0
        setIsDragging(false)
        const file = event.dataTransfer.files[0]
        if (file) void loadFile(file)
      }}
    >
      <ThemeSync />
      <EncodeBridge />
      <div className={`mx-auto flex max-w-[1440px] flex-col ${hasSource ? 'h-dvh overflow-hidden' : 'min-h-dvh'}`}>
        <Header />
        {hasSource ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
            <Preview />
            <Controls />
          </div>
        ) : (
          <DropZone />
        )}
      </div>
      {isDragging ? (
        <div className="overlay-in pointer-events-none absolute inset-0 z-20 grid place-items-center bg-ink/80 px-6 text-center backdrop-blur-sm">
          <p className="rise text-4xl font-semibold tracking-tight">{t('dropOverlay')}</p>
        </div>
      ) : null}
    </div>
  )
}
