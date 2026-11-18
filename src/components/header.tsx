import { FILE_ACCEPT, takeFile } from '../lib/files'
import { useI18n } from '../lib/use-i18n'
import { useResolvedTheme } from '../lib/use-theme'
import { useEditorStore } from '../store/editor-store'
import { usePreferences } from '../store/preferences-store'
import { ExitIcon, MoonIcon, ReplaceIcon, SunIcon } from './icons'

export function Header() {
  const hasSource = useEditorStore((state) => state.source !== null)
  const loadFile = useEditorStore((state) => state.loadFile)
  const leave = useEditorStore((state) => state.leave)
  const locale = usePreferences((state) => state.locale)
  const setTheme = usePreferences((state) => state.setTheme)
  const setLocale = usePreferences((state) => state.setLocale)
  const resolved = useResolvedTheme()
  const { t } = useI18n()
  const nextLocale = locale === 'ko' ? 'en' : 'ko'

  return (
    <header className="flex shrink-0 items-center justify-between gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 md:px-8 md:pt-[max(1rem,env(safe-area-inset-top))] md:pb-4">
      <div className="flex min-w-0 items-center gap-2.5">
        {hasSource ? (
          <button
            type="button"
            aria-label={t('leave')}
            onClick={leave}
            className="grid h-10 w-10 cursor-pointer place-items-center rounded-full text-muted transition duration-200 hover:bg-sunken hover:text-cream active:scale-95"
          >
            <ExitIcon className="h-4 w-4" />
          </button>
        ) : null}
        <span className="brand-dot inline-block h-2.5 w-2.5 rounded-full bg-accent" />
        <span className="text-sm font-semibold tracking-[0.2em]">{t('brand')}</span>
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
        <p className="hidden text-right text-xs leading-5 text-muted sm:block">{t('stayLocal')}</p>
        <div className="flex items-center justify-end gap-2">
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
            <span className={`relative z-10 px-2.5 text-sm font-semibold transition-colors duration-300 sm:px-3 ${locale === 'ko' ? 'text-ink' : 'text-muted'}`}>
              한글
            </span>
            <span className={`relative z-10 px-2.5 text-sm font-semibold transition-colors duration-300 sm:px-3 ${locale === 'en' ? 'text-ink' : 'text-muted'}`}>
              EN
            </span>
          </button>
          {hasSource ? (
            <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-full bg-sunken text-sm ring-1 ring-line max-sm:w-10 sm:px-4">
              <ReplaceIcon className="h-4 w-4 sm:hidden" />
              <span className="max-sm:sr-only">{t('changeImage')}</span>
              <input
                type="file"
                accept={FILE_ACCEPT}
                className="sr-only"
                onChange={(event) => {
                  const file = takeFile(event.currentTarget)
                  if (file) void loadFile(file)
                }}
              />
            </label>
          ) : null}
        </div>
      </div>
    </header>
  )
}
