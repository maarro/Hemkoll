import { useId } from 'react'
import type { PricePoint } from '../ha/types'
import { priceLevel, TONE_COLOR, type PriceTone } from '../ha/usePrices'

interface Props {
  prices: PricePoint[]
  avg: number
  max: number
  nowIdx: number
  W: number
  H: number
  pad?: { l: number; r: number; t: number; b: number }
  /** Markerad punkt (hover), annars nu */
  focus?: number
  /** Billigaste fönster att markera */
  band?: { from: number; len: number }
  /** Rita axlar och klockslag */
  axes?: boolean
  onFocus?: (i: number | null) => void
}

/**
 * Elpriset som trappstegslinje, färgad efter prisnivå som i Tibber-appen:
 * grön när det är normalt eller billigt, gul när det är dyrt, röd när det är mycket dyrt.
 * Det som passerat tonas ner. En grön prick visar var vi är just nu.
 */
export function PriceLine({ prices, avg, max, nowIdx, W, H, pad = { l: 0, r: 0, t: 6, b: 2 }, focus, band, axes, onFocus }: Props) {
  const uid = useId().replace(/:/g, '')
  const n = prices.length
  const bw = (W - pad.l - pad.r) / n
  const top = max * 1.08 || 1
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / top)
  const x = (i: number) => pad.l + i * bw
  const base = H - pad.b
  const tone = (i: number): PriceTone => priceLevel(prices[i].price, avg).tone

  // Dela upp i sammanhängande bitar med samma nivå
  const runs: { from: number; to: number; tone: PriceTone }[] = []
  for (let i = 0; i < n; i++) {
    const t = tone(i)
    const last = runs[runs.length - 1]
    if (last && last.tone === t) last.to = i
    else runs.push({ from: i, to: i, tone: t })
  }
  const stepPath = (from: number, to: number) => {
    let d = `M${x(from).toFixed(1)},${y(prices[from].price).toFixed(1)}`
    for (let i = from; i <= to; i++) {
      const yy = y(prices[i].price).toFixed(1)
      if (i > from) d += ` L${x(i).toFixed(1)},${yy}`
      d += ` L${(x(i) + bw).toFixed(1)},${yy}`
    }
    return d
  }
  const f = focus ?? nowIdx
  const ticks = [0, max / 2, max].map((v) => Math.round(v * 10) / 10)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="price-line" preserveAspectRatio={axes ? undefined : "none"} onMouseLeave={() => onFocus?.(null)}>
      <defs>
        {(Object.keys(TONE_COLOR) as PriceTone[]).map((t) => (
          <linearGradient key={t} id={`${uid}-${t}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={TONE_COLOR[t]} stopOpacity="0.38" />
            <stop offset="1" stopColor={TONE_COLOR[t]} stopOpacity="0" />
          </linearGradient>
        ))}
        {nowIdx > 0 && (
          <clipPath id={`${uid}-past`}>
            <rect x="0" y="0" width={x(nowIdx)} height={H} />
          </clipPath>
        )}
      </defs>

      {axes &&
        ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="grid" />
            <text x={pad.l - 6} y={y(t) + 3} className="axis" textAnchor="end">
              {t.toLocaleString('sv-SE')}
            </text>
          </g>
        ))}

      {band && band.from >= 0 && <rect x={x(band.from)} y={pad.t} width={bw * band.len} height={base - pad.t} rx="6" className="best-band" />}

      {runs.map((r) => {
        const line = stepPath(r.from, r.to)
        const area = `${line} L${(x(r.to) + bw).toFixed(1)},${base} L${x(r.from).toFixed(1)},${base} Z`
        return (
          <g key={r.from}>
            <path d={area} fill={`url(#${uid}-${r.tone})`} />
            <path d={line} fill="none" stroke={TONE_COLOR[r.tone]} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </g>
        )
      })}

      {/* Passerade timmar tonas ner */}
      {nowIdx > 0 && <rect x="0" y="0" width={x(nowIdx)} height={base} className="price-past" clipPath={`url(#${uid}-past)`} />}

      {/* Markör: linje och prick */}
      {f >= 0 && f < n && (
        <g className="price-marker">
          <line x1={x(f) + bw / 2} x2={x(f) + bw / 2} y1={pad.t} y2={base} className="marker-line" vectorEffect="non-scaling-stroke" />
        </g>
      )}

      {axes &&
        [0, 6, 12, 18].map((hr) => {
          const i = prices.findIndex((p) => new Date(p.start).getHours() === hr && new Date(p.start).getMinutes() === 0)
          return i < 0 ? null : (
            <text key={hr} x={x(i)} y={H - 4} className="axis">
              {String(hr).padStart(2, '0')}
            </text>
          )
        })}

      {/* Osynliga träffytor för att peka */}
      {onFocus &&
        prices.map((p, i) => (
          <rect key={p.start} x={x(i)} y={0} width={bw} height={H} fill="transparent" onMouseEnter={() => onFocus(i)} onTouchStart={() => onFocus(i)} />
        ))}
    </svg>
  )
}

/** Var pricken ska sitta, i procent av ytan, så att den kan ligga utanför svg:n och förbli rund. */
export function dotPos(prices: PricePoint[], i: number, max: number, W: number, H: number, pad = { l: 0, r: 0, t: 6, b: 2 }) {
  const bw = (W - pad.l - pad.r) / prices.length
  const top = max * 1.08 || 1
  const yy = pad.t + (H - pad.t - pad.b) * (1 - prices[i].price / top)
  return { left: `${((pad.l + i * bw + bw / 2) / W) * 100}%`, top: `${(yy / H) * 100}%` }
}
