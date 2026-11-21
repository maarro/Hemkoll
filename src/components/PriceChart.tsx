import { useEffect, useMemo, useState } from 'react'
import { useHass } from '../ha/HassProvider'
import type { PricePoint } from '../ha/types'

const fmt = (n: number) => n.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })

/** Dagens elpris som stapeldiagram. Nuvarande period markerad, billigaste timmen utpekad. */
export function PriceChart() {
  const { getPrices, status } = useHass()
  const [prices, setPrices] = useState<PricePoint[]>([])
  const [hover, setHover] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    const load = () =>
      getPrices()
        .then((p) => alive && (setPrices(p), setFailed(false)))
        .catch(() => alive && setFailed(true))
    if (status === 'connected' || status === 'demo') load()
    const t = setInterval(load, 15 * 60_000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [getPrices, status])

  const stats = useMemo(() => {
    if (!prices.length) return null
    const nowT = Date.now()
    const step = prices.length > 1 ? new Date(prices[1].start).getTime() - new Date(prices[0].start).getTime() : 3600_000
    const nowIdx = prices.findIndex((p) => {
      const s = new Date(p.start).getTime()
      return nowT >= s && nowT < s + step
    })
    const max = Math.max(...prices.map((p) => p.price))
    // Billigaste sammanhängande timmen framåt i tiden
    const per = Math.max(1, Math.round(3600_000 / step))
    let best = -1
    let bestAvg = Infinity
    for (let i = Math.max(0, nowIdx); i + per <= prices.length; i++) {
      const avg = prices.slice(i, i + per).reduce((a, p) => a + p.price, 0) / per
      if (avg < bestAvg) (bestAvg = avg), (best = i)
    }
    return { nowIdx, max, best, bestAvg, per }
  }, [prices])

  if (failed) return <p className="muted">Kunde inte hämta elpriser. Är Tibber-integrationen installerad i Home Assistant?</p>
  if (!stats) return <p className="muted">Hämtar elpriser…</p>

  const W = 640
  const H = 160
  const pad = { l: 34, r: 4, t: 8, b: 20 }
  const bw = (W - pad.l - pad.r) / prices.length
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / (stats.max * 1.05))
  const shown = hover ?? stats.nowIdx
  const ticks = [0, stats.max / 2, stats.max].map((v) => Math.round(v * 10) / 10)

  return (
    <div className="chart">
      <div className="chart-head">
        <div>
          <div className="muted small">{shown === stats.nowIdx ? 'Just nu' : hhmm(prices[shown]?.start)}</div>
          <div className="big">
            {shown >= 0 ? fmt(prices[shown].price) : '–'} <span className="unit">kr/kWh</span>
          </div>
        </div>
        {stats.best >= 0 && (
          <div className="tip">
            Billigaste timmen: <strong>{hhmm(prices[stats.best].start)}</strong>
            <br />
            <span className="muted small">snitt {fmt(stats.bestAvg)} kr/kWh</span>
          </div>
        )}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="price-svg"
        role="img"
        aria-label="Elpris idag"
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="grid" />
            <text x={pad.l - 6} y={y(t) + 3} className="axis" textAnchor="end">
              {t.toLocaleString('sv-SE')}
            </text>
          </g>
        ))}
        {stats.best >= 0 && (
          <rect
            x={pad.l + stats.best * bw}
            y={pad.t}
            width={bw * stats.per}
            height={H - pad.t - pad.b}
            className="best-band"
          />
        )}
        {prices.map((p, i) => {
          const x = pad.l + i * bw
          const h = Math.max(1, H - pad.b - y(p.price))
          const past = i < stats.nowIdx
          return (
            <g key={p.start} onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)}>
              <rect x={x} y={pad.t} width={bw} height={H - pad.t - pad.b} fill="transparent" />
              <rect
                x={x + 1}
                y={H - pad.b - h}
                width={Math.max(1, bw - 2)}
                height={h}
                rx={Math.min(2, bw / 3)}
                className={i === stats.nowIdx ? 'bar now' : past ? 'bar past' : 'bar'}
              />
            </g>
          )
        })}
        {[0, 6, 12, 18].map((hr) => {
          const i = prices.findIndex((p) => new Date(p.start).getHours() === hr)
          return i < 0 ? null : (
            <text key={hr} x={pad.l + i * bw} y={H - 5} className="axis">
              {String(hr).padStart(2, '0')}
            </text>
          )
        })}
      </svg>
    </div>
  )
}
