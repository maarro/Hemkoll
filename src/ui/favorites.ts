// Favoriter sparas i den här webbläsaren (bekvämlighet per mobil).
import { useSyncExternalStore } from 'react'

const KEY = 'hemkoll.favorites'
const DEFAULT = ['media_player.sonos_kok', 'switch.tv_bank', 'lock.ytterdorr']

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as string[]) : DEFAULT
  } catch {
    return DEFAULT
  }
}

let current = read()
const listeners = new Set<() => void>()

export function toggleFavorite(id: string) {
  current = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    /* sparas bara i minnet */
  }
  listeners.forEach((l) => l())
}

export function useFavorites() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
  )
}
