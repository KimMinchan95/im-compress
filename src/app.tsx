import { useEffect, useRef, useState } from 'react'
import { Controls } from './components/controls'
import { ACCEPT, DropZone } from './components/drop-zone'
import { Preview } from './components/preview'
import { useI18n } from './lib/use-i18n'
import { useEncoder } from './lib/use-encoder'
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
  const theme = usePreferences((state) => state.theme)
  const locale = usePreferences((state) => state.locale)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.lang = locale
    document.title = locale === 'ko' ? '이미지 압축' : 'Compress'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f3efe7' : '#100f0d')
  }, [locale, theme])

  return null
}

function Header() {
  const hasSource = useEditorStore((state) => state.source !== null)
  const loadFile = useEditorStore((state) => state.loadFile)
  const theme = usePreferences((state) => state.theme)
  const locale = usePreferences((state) => state.locale)
  const setTheme = usePreferences((state) => state.setTheme)
  const setLocale = usePreferences((state) => state.setLocale)
  const { t } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 md:px-8">
      <div className="flex items-center gap-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-accent" />
        <span className="text-sm font-semibold tracking-[0.2em]">{t('brand')}</span>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="flex rounded-full bg-sunken p-1 ring-1 ring-line" role="group" aria-label={t('themeToLight')}>
          <HeaderChoice pressed={theme === 'light'} onClick={() => setTheme('light')}>
            {t('themeToLight')}
          </HeaderChoice>
          <HeaderChoice pressed={theme === 'dark'} onClick={() => setTheme('dark')}>
            {t('themeToDark')}
          </HeaderChoice>
        </div>
        <div className="flex rounded-full bg-sunken p-1 ring-1 ring-line" role="group" aria-label={t('language')}>
          <HeaderChoice pressed={locale === 'ko'} onClick={() => setLocale('ko')}>
            한글
          </HeaderChoice>
          <HeaderChoice pressed={locale === 'en'} onClick={() => setLocale('en')}>
            EN
          </HeaderChoice>
        </div>
        {hasSource ? (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="h-10 rounded-full bg-sunken px-4 text-sm ring-1 ring-line"
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
        ) : (
          <p className="hidden text-xs text-muted sm:block">{t('stayLocal')}</p>
        )}
      </div>
    </header>
  )
}

function HeaderChoice({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`h-8 rounded-full px-3 text-sm font-medium transition ${
        pressed ? 'bg-cream text-ink' : 'text-muted hover:text-cream'
      }`}
    >
      {children}
    </button>
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
      className="relative min-h-dvh bg-ink font-sans text-cream"
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
      <div className="mx-auto flex min-h-dvh max-w-[1440px] flex-col">
        <Header />
        {hasSource ? (
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            <Preview />
            <Controls />
          </div>
        ) : (
          <DropZone />
        )}
      </div>
      {isDragging ? (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-ink/80 px-6 text-center backdrop-blur-sm">
          <p className="text-4xl font-semibold tracking-tight">{t('dropOverlay')}</p>
        </div>
      ) : null}
    </div>
  )
}
