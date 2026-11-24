import type { ComponentType } from 'react'
import { FILE_ACCEPT, takeFiles } from '../lib/files'
import { openIncoming } from '../lib/open-incoming'
import { errorMessage } from '../lib/error-message'
import { useI18n } from '../lib/use-i18n'
import { useEditorStore } from '../store/editor-store'
import { InstagramIcon, MailIcon } from './icons'

const FORMATS = ['JPG', 'WebP', 'PNG']

interface ContactLink {
  href: string
  label: 'email' | 'instagram'
  icon: ComponentType<{ className?: string }>
  external?: boolean
}

const LINKS: ContactLink[] = [
  { href: 'mailto:hialscks@gmail.com', label: 'email', icon: MailIcon },
  { href: 'https://www.instagram.com/chan_pest/', label: 'instagram', icon: InstagramIcon, external: true },
]

export function DropZone() {
  const error = useEditorStore((state) => state.error)
  const isReading = useEditorStore((state) => state.isReading)
  const { locale, t } = useI18n()

  return (
    <main className="relative flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-5 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:px-10 md:py-8">
      <div className="relative z-10 mx-auto my-auto grid w-full max-w-6xl grid-cols-1 items-center gap-6 md:grid-cols-2 md:gap-16">
        <div className="contents md:flex md:flex-col md:justify-center">
          <div className="order-1 text-center md:order-none md:text-left">
            <p className="rise flex items-center justify-center gap-2 text-xs font-semibold tracking-[0.22em] text-accent md:justify-start">
              <span className="brand-dot inline-block h-2 w-2 rounded-full bg-accent" />
              {t('eyebrow')}
            </p>
            <h1 className="hero-sheen rise mt-4 break-keep text-[2rem] leading-[1.2] font-semibold tracking-tight sm:text-5xl xl:text-7xl" style={{ animationDelay: '80ms' }}>
              {t('heroTitle')}
            </h1>
            <p className="rise mx-auto mt-4 max-w-xl break-keep text-base text-muted md:mx-0" style={{ animationDelay: '150ms' }}>
              {t('heroBody')}
            </p>
          </div>
          <div className="order-4 text-center md:order-none md:mt-8 md:text-left">
            <p className="mt-0 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-sm font-medium text-muted md:justify-start">
              {FORMATS.map((label, index) => (
                <span
                  key={label}
                  className="rise inline-flex items-center gap-2.5"
                  style={{ animationDelay: `${220 + index * 70}ms` }}
                >
                  {index > 0 ? <span aria-hidden="true" className="h-1 w-1 rounded-full bg-current opacity-40" /> : null}
                  {label}
                </span>
              ))}
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 md:items-start">
              <p className="text-sm text-muted">{t('bugReport')}</p>
              <div className="flex items-center gap-2">
                {LINKS.map(({ href, label, icon: Icon, external }) => (
                  <a
                    key={label}
                    href={href}
                    aria-label={t(label)}
                    {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
                    className="grid h-11 w-11 cursor-pointer place-items-center rounded-full bg-sunken text-cream ring-1 ring-line transition duration-200 hover:scale-105 hover:text-accent active:scale-95"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="contents md:flex md:flex-col md:items-center md:gap-5">
          <div className="order-3 mx-auto w-full max-w-md md:order-none">
            <CompareShowcase original={t('original')} compressed={t('compressed')} />
          </div>
          <div className="drop-shell rise order-2 mx-auto w-full max-w-md md:order-none" style={{ animationDelay: '260ms' }}>
            <div className="drop-spin" aria-hidden="true" />
            <label className="drop-face">
              <input
                type="file"
                accept={FILE_ACCEPT}
                multiple
                className="sr-only"
                onChange={(event) => openIncoming(takeFiles(event.currentTarget))}
              />
              <span className={`grid h-16 w-16 place-items-center rounded-2xl bg-accent text-3xl font-semibold text-on-accent ${isReading ? 'animate-pulse' : 'bob'}`}>
                +
              </span>
              <span className="mt-6 break-keep text-2xl font-semibold">{isReading ? t('dropReading') : t('dropTitle')}</span>
              <span className="mt-2 text-sm text-muted">{t('dropHint')}</span>
              <span className="mt-1 text-sm text-muted">{t('dropMany')}</span>
            </label>
          </div>
        </div>
      </div>
      {error ? <p className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-sm text-accent">{errorMessage(locale, error)}</p> : null}
    </main>
  )
}

interface CompareShowcaseProps {
  original: string
  compressed: string
}

function CompareShowcase({ original, compressed }: CompareShowcaseProps) {
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
