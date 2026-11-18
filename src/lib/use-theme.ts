import { useEffect, useState } from 'react'
import { resolveTheme, usePreferences, type Theme } from '../store/preferences-store'

export function useHydrated() {
  const [hydrated, setHydrated] = useState(() => usePreferences.persist.hasHydrated())

  useEffect(() => {
    setHydrated(usePreferences.persist.hasHydrated())
    return usePreferences.persist.onFinishHydration(() => setHydrated(true))
  }, [])

  return hydrated
}

export function useResolvedTheme(): Theme {
  const choice = usePreferences((state) => state.theme)
  const [system, setSystem] = useState<Theme>(() => resolveTheme('system'))

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)')
    const apply = () => setSystem(media.matches ? 'light' : 'dark')
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [])

  return choice === 'system' ? system : choice
}
