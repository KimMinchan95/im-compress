import { useEffect } from 'react'
import { Controls } from './components/controls'
import { DropZone } from './components/drop-zone'
import { Header } from './components/header'
import { Preview } from './components/preview'
import { paintDocumentTheme } from './lib/document-theme'
import { isKakaoTalk, openKakaoExternal } from './lib/files'
import { useFileDrop } from './lib/use-file-drop'
import { useI18n } from './lib/use-i18n'
import { useEncoder } from './lib/use-encoder'
import { useHydrated, useResolvedTheme } from './lib/use-theme'
import { useEditorStore } from './store/editor-store'
import { usePreferences } from './store/preferences-store'

const DOCUMENT_TITLE = {
  ko: '이미지 압축',
  en: 'Compress',
} as const

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
    paintDocumentTheme(resolved)
    document.documentElement.lang = locale
    document.title = DOCUMENT_TITLE[locale]
  }, [hydrated, locale, resolved])

  return null
}

export default function App() {
  const hasSource = useEditorStore((state) => state.source !== null)
  const loadFile = useEditorStore((state) => state.loadFile)
  const { t } = useI18n()
  const { isDragging, dropHandlers } = useFileDrop((file) => {
    void loadFile(file)
  })

  return (
    <div
      className="relative min-h-dvh overflow-x-hidden bg-ink font-sans text-cream"
      {...dropHandlers}
    >
      <ThemeSync />
      <EncodeBridge />
      <div className={`mx-auto flex max-w-[1440px] flex-col ${hasSource ? 'h-dvh overflow-hidden' : 'min-h-dvh'}`}>
        <Header />
        {isKakaoTalk() ? (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-sunken px-4 py-2.5 md:px-8">
            <p className="text-sm leading-5 text-cream">{t('kakaoDownload')}</p>
            <button
              type="button"
              onClick={openKakaoExternal}
              className="h-9 shrink-0 cursor-pointer rounded-full bg-accent px-3 text-sm font-semibold text-on-accent transition duration-200 active:scale-[0.98]"
            >
              {t('openBrowser')}
            </button>
          </div>
        ) : null}
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
