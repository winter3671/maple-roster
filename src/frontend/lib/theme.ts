export type Theme = 'light' | 'dark'
const preference = 'maple-roster.theme'

export function readTheme(): Theme {
  try {
    return localStorage.getItem(preference) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
}

export function saveTheme(theme: Theme): boolean {
  applyTheme(theme)
  try {
    localStorage.setItem(preference, theme)
    return true
  } catch {
    return false
  }
}
