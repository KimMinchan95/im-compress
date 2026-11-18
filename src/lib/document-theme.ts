const THEME_COLOR = {
  light: '#f3efe7',
  dark: '#100f0d',
} as const

export function paintDocumentTheme(theme: keyof typeof THEME_COLOR) {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme])
}
