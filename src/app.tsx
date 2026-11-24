import { useEffect } from 'react'
import { BatchView } from './components/batch-view'
import { Controls } from './components/controls'
import { DropZone } from './components/drop-zone'
import { Header } from './components/header'
import { Preview } from './components/preview'
import { useBatchRunner } from './lib/batch-runner'
import { paintDocumentTheme } from './lib/document-theme'
import { isKakaoTalk, kakaoExternalUrl, leaveKakaoOnce } from './lib/files'
import { openIncoming } from './lib/open-incoming'
import { useFileDrop } from './lib/use-file-drop'
import { useI18n } from './lib/use-i18n'
import { useEncoder } from './lib/use-encoder'
import { useHydrated, useResolvedTheme } from './lib/use-theme'
import { useBatchStore } from './store/batch-store'
import { useEditorStore } from './store/editor-store'
import { usePreferences } from './store/preferences-store'

const DOCUMENT_TITLE = {
  ko: '이미지 압축',
  en: 'Compress',
} as const

function EncodeBridge() {
  useEncoder()
  useBatchRunner()
  return null
}

function KakaoGate() {
  const { t } = useI18n()

  useEffect(() => {
    leaveKakaoOnce()
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-ink px-6 text-center">
      <p className="max-w-sm text-lg font-semibold leading-7">{t('kakaoDownload')}</p>
      <a
        href={kakaoExternalUrl(window.location.href)}
        className="inline-flex h-12 items-center rounded-full bg-accent px-6 text-base font-semibold text-on-accent transition duration-200 active:scale-[0.98]"
      >
        {t('openBrowser')}
      </a>
    </div>
  )
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
  const showBatch = useBatchStore((state) => state.items.length > 0 || state.isOpening)
  const { t } = useI18n()
  const { isDragging, dropHandlers } = useFileDrop(openIncoming)

  return (
    <div
      className="relative flex h-dvh flex-col overflow-hidden bg-ink font-sans text-cream"
      {...dropHandlers}
    >
      <ThemeSync />
      <EncodeBridge />
      {hasSource || showBatch ? null : (
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="orb orb-a" />
          <div className="orb orb-b" />
          <div className="orb orb-c" />
        </div>
      )}
      <div className="relative z-10 mx-auto flex h-full w-full flex-col">
        <Header />
        {hasSource ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
            <Preview />
            <Controls />
          </div>
        ) : showBatch ? (
          <BatchView />
        ) : (
          <DropZone />
        )}
      </div>
      {isKakaoTalk() ? <KakaoGate /> : null}
      {isDragging ? (
        <div className="overlay-in pointer-events-none absolute inset-0 z-20 grid place-items-center bg-ink/80 px-6 text-center backdrop-blur-sm">
          <p className="rise text-4xl font-semibold tracking-tight">{t('dropOverlay')}</p>
        </div>
      ) : null}
    </div>
  )
}
