import type { Settings } from './types'

const KEY = 'hemkoll.settings'

/** Om appen körs från Home Assistants /local/-mapp är HA samma adress. */
function defaultUrl() {
  if (typeof window === 'undefined') return ''
  return window.location.pathname.startsWith('/local/') ? window.location.origin : ''
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { url: '', token: '', demo: false, ...JSON.parse(raw) }
  } catch {
    /* localStorage kan saknas – kör vidare med standard */
  }
  return { url: defaultUrl(), token: '', demo: true }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* ignorera */
  }
}
