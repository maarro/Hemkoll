import { ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useHass } from '../ha/HassProvider'
import { num, tibber } from '../ha/selectors'
import { kr, priceStats, usePrices } from '../ha/usePrices'

const MINUTES = 60

/** Husets puls: vad huset drar just nu, som en levande kurva över senaste timmen. */
export function PowerPulse({ onOpen }: { onOpen: () => void }) {
  const { entities, getHistory, status } = useHass()
  const t = tibber(entities)
  const power = num(t.power)
  const cost = num(t.cost)
  const { prices } = usePrices()
  const st = priceStats(prices, 1)
  const [pts, setPts] = useState<[number, number][]>([])
  const powerId = t.power?.entity_id ?? ''

  useEffect(() => {
    if (!powerId || (status !== 'connected' && status !== 'demo')) return
    let alive = true
    getHistory(powerId, MINUTES)
      .then((h) => alive && setPts(h))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [getHistory, powerId, status])

  // Lägg till nya värden när de kommer in, max en gång per 10 sekunder.
  const last = useRef(0)
  useEffect(() => {
    if (power === undefined) return
    const now = Date.now()
    if (now - last.current < 10_000) return
    last.current = now
    setPts((p) => [...p.filter(([t0]) => t0 > now - MINUTES * 60_000), [now, power]])
  }, [power])

  const level = st?.now === undefined ? null : st.now > st.avg * 1.35 ? 'dyrt' : st.now < st.avg * 0.75 ? 'billigt' : 'normalt'

  const path = useMemo(() => {
    if (pts.length < 2) return null
    const W = 320
    const H = 84
    const t0 = Date.now() - MINUTES * 60_000
    const max = Math.max(1500, ...pts.map(([, v]) => v)) * 1.08
    const xy = pts.map(([t1, v]) => [((t1 - t0) / (MINUTES * 60_000)) * W, H - (v / max) * (H - 6) - 2] as const)
    let d = `M${xy[0][0].toFixed(1)},${xy[0][1].toFixed(1)}`
    for (let i = 1; i < xy.length; i++) {
      const [x0, y0] = xy[i - 1]
      const [x1, y1] = xy[i]
      const cx = (x0 + x1) / 2
      d += ` C${cx.toFixed(1)},${y0.toFixed(1)} ${cx.toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`
    }
    const end = xy[xy.length - 1]
    return { line: d, area: `${d} L${end[0].toFixed(1)},${H} L${xy[0][0].toFixed(1)},${H} Z`, end, W, H }
  }, [pts])

  const kw = power === undefined ? '–' : (power / 1000).toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <button className="pulse" onClick={onOpen} aria-label="Visa energi">
      <div className="pulse-head">
        <div>
          <div className="pulse-label">Huset drar just nu</div>
          <div className="pulse-value">
            {kw}
            <span className="pulse-unit">kW</span>
          </div>
        </div>
        <ChevronRight className="pulse-chev" size={20} aria-hidden />
      </div>
      {path && (
        <div className="pulse-graph">
          <svg viewBox={`0 0 ${path.W} ${path.H}`} preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id="pulseFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--ice)" stopOpacity="0.32" />
                <stop offset="1" stopColor="var(--ice)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={path.area} fill="url(#pulseFill)" />
            <path d={path.line} fill="none" stroke="var(--ice)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
          </svg>
          <span className="pulse-dot" style={{ left: `${(path.end[0] / path.W) * 100}%`, top: `${(path.end[1] / path.H) * 100}%` }} aria-hidden />
        </div>
      )}
      <div className="pulse-foot">
        <span className={`price-chip ${level ?? ''}`}>
          {st?.now !== undefined ? `${kr(st.now)} kr/kWh` : 'Elpris saknas'}
          {level && <span className="price-level">{level}</span>}
        </span>
        <span className="pulse-cost">
          {cost !== undefined ? `${cost.toLocaleString('sv-SE', { maximumFractionDigits: 0 })} kr hittills idag` : ''}
        </span>
      </div>
    </button>
  )
}
