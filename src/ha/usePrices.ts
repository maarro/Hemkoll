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

  // prices = idag (för diagram), ahead = idag och i morgon (för planering framåt)
  const today = new Date().toDateString()
  const todays = prices.filter((p) => new Date(p.start).toDateString() === today)
  return { prices: todays.length ? todays : prices, ahead: prices, failed }
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

/**
 * Billigaste starttid för något som drar kwh under hours timmar, räknat från nu
 * och så långt priserna räcker. Jämförs med att starta direkt.
 */
export function bestStart(prices: PricePoint[], hours: number, kwh: number) {
  if (prices.length < 2) return null
  const step = new Date(prices[1].start).getTime() - new Date(prices[0].start).getTime()
  const per = Math.max(1, Math.round((hours * 3600_000) / step))
  const now = Date.now()
  const first = prices.findIndex((p) => new Date(p.start).getTime() + step > now)
  if (first < 0 || first + per > prices.length) return null
  const cost = (i: number) => (prices.slice(i, i + per).reduce((s, p) => s + p.price, 0) / per) * kwh
  let best = first
  for (let i = first; i + per <= prices.length; i++) if (cost(i) < cost(best)) best = i
  const start = Math.max(now, new Date(prices[best].start).getTime())
  return { start, cost: cost(best), costNow: cost(first), isNow: best === first }
}

/** "02:15" idag, "i morgon 02:15" annars. */
export function when(ms: number) {
  const d = new Date(ms)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return d.toDateString() === tomorrow.toDateString() ? `i morgon ${hhmm(ms)}` : hhmm(ms)
}
