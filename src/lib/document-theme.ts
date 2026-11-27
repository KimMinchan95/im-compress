const THEME_COLOR = {
  light: '#ffffff',
  dark: '#000000',
} as const

export function paintDocumentTheme(theme: keyof typeof THEME_COLOR) {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme])
}
