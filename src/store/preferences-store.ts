import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'light' | 'dark'
export type Locale = 'ko' | 'en'

interface PreferencesState {
  theme: Theme
  locale: Locale
  splitView: boolean
  setTheme: (theme: Theme) => void
  setLocale: (locale: Locale) => void
  setSplitView: (splitView: boolean) => void
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'dark',
      locale: 'ko',
      splitView: false,
      setTheme: (theme) => {
        if (typeof document !== 'undefined') document.documentElement.dataset.theme = theme
        set({ theme })
      },
      setLocale: (locale) => {
        if (typeof document !== 'undefined') document.documentElement.lang = locale
        set({ locale })
      },
      setSplitView: (splitView) => set({ splitView }),
    }),
    {
      name: 'im-compress-preferences',
      partialize: (state) => ({ theme: state.theme, locale: state.locale }),
    },
  ),
)
