import { useEffect, useState } from 'react'
import { useHass } from './HassProvider'
import type { PricePoint } from './types'

// Delad cache så att startsidan och Energi inte hämtar priserna var för sig.
let cache: { at: number; key: string; data: PricePoint[] } | null = null

export function usePrices() {
  const { getPrices, status } = useHass()
  const key = status
  const [prices, setPrices] = useState<PricePoint[]>(cache?.key === key ? cache.data : [])
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (status !== 'connected' && status !== 'demo') return
    let alive = true
    const load = () => {
      if (cache && cache.key === key && Date.now() - cache.at < 10 * 60_000) {
        setPrices(cache.data)
        return
      }
      getPrices()
        .then((p) => {
          cache = { at: Date.now(), key, data: p }
          if (alive) (setPrices(p), setFailed(false))
        })
        .catch(() => alive && setFailed(true))
    }
    load()
    const t = setInterval(load, 15 * 60_000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [getPrices, status, key])

  return { prices, failed }
}

/** Nuvarande period, dygnets snitt och billigaste sammanhängande fönster framåt. */
export function priceStats(prices: PricePoint[], windowHours = 1) {
  if (!prices.length) return null
  const step = prices.length > 1 ? new Date(prices[1].start).getTime() - new Date(prices[0].start).getTime() : 3600_000
  const now = Date.now()
  const nowIdx = prices.findIndex((p) => {
    const s = new Date(p.start).getTime()
    return now >= s && now < s + step
  })
  const avg = prices.reduce((a, p) => a + p.price, 0) / prices.length
  const max = Math.max(...prices.map((p) => p.price))
  const per = Math.max(1, Math.round((windowHours * 3600_000) / step))
  let best = -1
  let bestAvg = Infinity
  for (let i = Math.max(0, nowIdx); i + per <= prices.length; i++) {
    const a = prices.slice(i, i + per).reduce((s, p) => s + p.price, 0) / per
    if (a < bestAvg) (bestAvg = a), (best = i)
  }
  return { step, nowIdx, now: nowIdx >= 0 ? prices[nowIdx].price : undefined, avg, max, best, bestAvg, per }
}

export const hhmm = (iso: string | number) => new Date(iso).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
export const kr = (n: number) => n.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
