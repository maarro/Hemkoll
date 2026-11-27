import { useMemo, useState } from 'react'
import { priceLevel, priceStats, usePrices } from '../ha/usePrices'
import { PriceLine, dotPos } from './PriceLine'

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
  const shown = hover ?? (stats.nowIdx >= 0 ? stats.nowIdx : stats.best)

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
      <div className="price-plot">
        <PriceLine
          prices={prices}
          avg={stats.avg}
          max={stats.max}
          nowIdx={stats.nowIdx}
          W={W}
          H={H}
          pad={pad}
          axes
          focus={shown}
          band={stats.best >= 0 ? { from: stats.best, len: stats.per } : undefined}
          onFocus={setHover}
        />
        {shown >= 0 && <span className={`pulse-dot price ${priceLevel(prices[shown].price, stats.avg).tone}`} style={dotPos(prices, shown, stats.max, W, H, pad)} aria-hidden />}
      </div>
      <div className="price-legend" aria-label="Färgerna">
        <span><i className="low" />Normalt eller billigt</span>
        <span><i className="mid" />Dyrt</span>
        <span><i className="high" />Mycket dyrt</span>
      </div>
    </div>
  )
}
