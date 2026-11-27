import { useMemo, useState } from 'react'
import { priceStats, usePrices } from '../ha/usePrices'

const fmt = (n: number) => n.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })

/** Dagens elpris som stapeldiagram. Nuvarande period markerad, billigaste timmen utpekad. */
export function PriceChart() {
  const { prices: today, ahead, failed } = usePrices()
  const [hover, setHover] = useState<number | null>(null)
  const [day, setDay] = useState<'idag' | 'imorgon'>('idag')
  const tomorrow = useMemo(() => {
    const t = new Date()
    t.setDate(t.getDate() + 1)
    return ahead.filter((p) => new Date(p.start).toDateString() === t.toDateString())
  }, [ahead])
  const prices = day === 'imorgon' && tomorrow.length ? tomorrow : today
  const stats = useMemo(() => priceStats(prices, 1), [prices])
  const isTomorrow = prices === tomorrow

  if (failed) return <p className="muted">Kunde inte hämta elpriser. Är Tibber-integrationen installerad i Home Assistant?</p>
  if (!stats) return <p className="muted">Hämtar elpriser…</p>

  const W = 640
  const H = 160
  const pad = { l: 34, r: 4, t: 8, b: 20 }
  const bw = (W - pad.l - pad.r) / prices.length
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / (stats.max * 1.05))
  const shown = hover ?? (stats.nowIdx >= 0 ? stats.nowIdx : stats.best)
  const ticks = [0, stats.max / 2, stats.max].map((v) => Math.round(v * 10) / 10)

  return (
    <div className="chart">
      {tomorrow.length > 0 && (
        <div className="segmented" role="tablist" aria-label="Välj dag">
          {(['idag', 'imorgon'] as const).map((d) => (
            <button
              key={d}
              role="tab"
              aria-selected={day === d}
              className={day === d ? 'sel' : ''}
              onClick={() => {
                setDay(d)
                setHover(null)
              }}
            >
              {d === 'idag' ? 'Idag' : 'I morgon'}
            </button>
          ))}
        </div>
      )}
      <div className="chart-head">
        <div>
          <div className="muted small">{shown === stats.nowIdx && stats.nowIdx >= 0 ? 'Just nu' : `${isTomorrow ? 'I morgon ' : ''}${hhmm(prices[shown]?.start)}`}</div>
          <div className="big">
            {shown >= 0 ? fmt(prices[shown].price) : '–'} <span className="unit">kr/kWh</span>
          </div>
        </div>
        {stats.best >= 0 && (
          <div className="tip">
            {isTomorrow ? 'Billigast i morgon' : 'Billigaste timmen'}: <strong>{hhmm(prices[stats.best].start)}</strong>
            <br />
            <span className="muted small">snitt {fmt(stats.bestAvg)} kr/kWh</span>
          </div>
        )}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="price-svg"
        role="img"
        aria-label={isTomorrow ? 'Elpris i morgon' : 'Elpris idag'}
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
