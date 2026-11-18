import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { paintDocumentTheme } from '../lib/document-theme'

export type Theme = 'light' | 'dark'
export type ThemeChoice = 'system' | Theme
export type Locale = 'ko' | 'en'

interface PreferencesState {
  theme: ThemeChoice
  locale: Locale
  setTheme: (theme: ThemeChoice) => void
  setLocale: (locale: Locale) => void
}

export function resolveTheme(choice: ThemeChoice): Theme {
  if (choice === 'light' || choice === 'dark') return choice
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'dark'
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function paintTheme(theme: ThemeChoice) {
  if (typeof document === 'undefined') return
  paintDocumentTheme(resolveTheme(theme))
}

function commitTheme(theme: ThemeChoice, set: (partial: Partial<PreferencesState>) => void) {
  const apply = () => {
    paintTheme(theme)
    set({ theme })
  }
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const canTransition = typeof document !== 'undefined' && typeof document.startViewTransition === 'function'
  if (canTransition && !reduce) {
    document.startViewTransition(apply)
    return
  }
  apply()
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'system',
      locale: 'ko',
      setTheme: (theme) => commitTheme(theme, set),
      setLocale: (locale) => {
        if (typeof document !== 'undefined') document.documentElement.lang = locale
        set({ locale })
      },
    }),
    {
      name: 'im-compress-preferences',
      version: 1,
      partialize: (state) => ({ theme: state.theme, locale: state.locale }),
      migrate: (persisted) => {
        const state = (persisted ?? {}) as { locale?: string }
        return {
          theme: 'system' as const,
          locale: state.locale === 'en' ? ('en' as const) : ('ko' as const),
        }
      },
    },
  ),
)
