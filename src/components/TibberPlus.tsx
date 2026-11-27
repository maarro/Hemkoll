import { ArrowDownRight, ArrowUpRight, Lightbulb, Mountain, Scale } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { config } from '../config'
import { useHass } from '../ha/HassProvider'
import { num, tibber } from '../ha/selectors'
import type { Usage } from '../ha/types'
import { kr } from '../ha/usePrices'

const DAYS = ['mån', 'tis', 'ons', 'tors', 'fre', 'lör', 'sön']
const pct = (n: number) => `${Math.round(Math.abs(n) * 100)} %`
const monthName = (d: Date) => d.toLocaleDateString('sv-SE', { month: 'long' })
const h2 = (h: number) => String(h).padStart(2, '0')

/** Hämtar timdata från början av förra månaden och räknar fram allt Tibber-relaterat. */
export function useTibberStats() {
  const { getUsage, status, entities } = useHass()
  const [hours, setHours] = useState<Usage[] | null>(null)

  useEffect(() => {
    if (status !== 'connected' && status !== 'demo') return
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    let alive = true
    const load = () =>
      getUsage(start, 'hour')
        .then((h) => alive && setHours(h))
        .catch(() => alive && setHours([]))
    load()
    const t = setInterval(load, 30 * 60_000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [getUsage, status])

  const tb = tibber(entities)
  const peakSensor = num(tb.peak)
  const peakTimeSensor = tb.peakTime?.state

  return useMemo(() => {
    if (!hours?.length) return null
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime()
    const elapsed = Date.now() - monthStart
    const month = hours.filter((u) => u.t >= monthStart)
    const prevSame = hours.filter((u) => u.t >= prevStart && u.t < Math.min(monthStart, prevStart + elapsed))
    const sum = (l: Usage[], k: 'kwh' | 'cost') => l.reduce((s, u) => s + (u[k] ?? 0), 0)
    const hasCost = month.some((u) => u.cost !== undefined)

    // Snittpris: ditt (viktat efter när du använder el) mot timmarnas rena snitt
    const priced = month.filter((u) => u.cost !== undefined && u.kwh > 0.05)
    const myAvg = hasCost && sum(month, 'kwh') > 0 ? sum(month, 'cost') / sum(month, 'kwh') : undefined
    const marketAvg = priced.length ? priced.reduce((s, u) => s + (u.cost as number) / u.kwh, 0) / priced.length : undefined

    // Förra månaden vid samma datum
    const key = hasCost ? 'cost' : 'kwh'
    const nowVal = sum(month, key)
    const prevVal = sum(prevSame, key)
    const vsPrev = prevSame.length > 24 && prevVal > 0 ? { diff: nowVal - prevVal, rel: (nowVal - prevVal) / prevVal, unit: hasCost ? 'kr' : 'kWh', name: monthName(new Date(prevStart)) } : undefined

    // Topptimme: Tibbers sensor i första hand, annars uträknad
    let peak: { kwh: number; t?: number } | undefined
    if (peakSensor !== undefined) peak = { kwh: peakSensor, t: peakTimeSensor && !isNaN(Date.parse(peakTimeSensor)) ? Date.parse(peakTimeSensor) : undefined }
    else if (month.length) {
      const m = month.reduce((a, b) => (b.kwh > a.kwh ? b : a))
      peak = { kwh: m.kwh, t: m.t }
    }

    // Veckomönster de senaste fyra veckorna: snitt-kWh per veckodag och timme
    const since = Date.now() - 28 * 86400_000
    const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ s: 0, n: 0, c: 0, cn: 0 })))
    for (const u of hours) {
      if (u.t < since) continue
      const d = new Date(u.t)
      const cell = grid[(d.getDay() + 6) % 7][d.getHours()]
      cell.s += u.kwh
      cell.n++
      if (u.cost !== undefined && u.kwh > 0.05) {
        cell.c += u.cost / u.kwh
        cell.cn++
      }
    }
    const heat = grid.map((row) => row.map((c) => (c.n ? c.s / c.n : 0)))

    // Tips: vilken timme på dygnet kostar mest, och vilken är billigast
    const byHour = Array.from({ length: 24 }, (_, h) => {
      let s = 0, n = 0, c = 0, cn = 0
      for (const row of grid) {
        s += row[h].s; n += row[h].n; c += row[h].c; cn += row[h].cn
      }
      return { h, kwh: n ? s / n : 0, price: cn ? c / cn : undefined }
    })
    let tip: { from: number; to: number; save: number; perKwh: number } | undefined
    const withPrice = byHour.filter((b) => b.price !== undefined)
    if (withPrice.length > 12) {
      const costly = withPrice.reduce((a, b) => (b.kwh * (b.price as number) > a.kwh * (a.price as number) ? b : a))
      const cheap = withPrice.reduce((a, b) => ((b.price as number) < (a.price as number) ? b : a))
      const perKwh = (costly.price as number) - (cheap.price as number)
      const load = config.appliances.reduce((s, a) => s + a.kwh, 0) || 3
      if (perKwh > 0.1) tip = { from: costly.h, to: cheap.h, perKwh, save: perKwh * load }
    }

    return { myAvg, marketAvg, vsPrev, peak, heat, tip, hasCost }
  }, [hours, peakSensor, peakTimeSensor])
}

type Stats = NonNullable<ReturnType<typeof useTibberStats>>

/** Din månad: snittpris mot marknaden, jämfört med förra månaden, topptimme. */
export function MonthInsight({ s }: { s: Stats }) {
  const rows: { icon: typeof Scale; tone: string; title: string; value: string; sub?: string }[] = []

  if (s.myAvg !== undefined && s.marketAvg !== undefined) {
    const rel = (s.myAvg - s.marketAvg) / s.marketAvg
    rows.push({
      icon: Scale,
      tone: rel <= 0 ? 'green' : 'orange',
      title: 'Ditt snittpris',
      value: `${kr(s.myAvg)} kr`,
      sub:
        Math.abs(rel) < 0.02
          ? `Samma som timmarnas snitt, ${kr(s.marketAvg)} kr/kWh`
          : rel < 0
            ? `${pct(rel)} under timmarnas snitt på ${kr(s.marketAvg)} kr. Du flyttar förbrukning bra.`
            : `${pct(rel)} över timmarnas snitt på ${kr(s.marketAvg)} kr. Mer el på billiga timmar sänker det.`,
    })
  }
  if (s.vsPrev) {
    const down = s.vsPrev.diff < 0
    const amount = Math.round(Math.abs(s.vsPrev.diff)).toLocaleString('sv-SE')
    rows.push({
      icon: down ? ArrowDownRight : ArrowUpRight,
      tone: down ? 'green' : 'red',
      title: `Mot ${s.vsPrev.name}`,
      value: `${down ? '−' : '+'}${pct(s.vsPrev.rel)}`,
      sub: `${amount} ${s.vsPrev.unit} ${down ? 'mindre' : 'mer'} än vid samma datum förra månaden`,
    })
  }
  if (s.peak) {
    const when = s.peak.t
      ? new Date(s.peak.t).toLocaleString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
      : undefined
    rows.push({
      icon: Mountain,
      tone: 'teal',
      title: 'Månadens topptimme',
      value: `${s.peak.kwh.toLocaleString('sv-SE', { maximumFractionDigits: 1 })} kWh`,
      sub: when ? `${when[0].toUpperCase()}${when.slice(1)}. Sprid ut tunga maskiner så hålls toppen nere.` : undefined,
    })
  }
  if (!rows.length) return null

  return (
    <section className="card">
      <h2>Din månad</h2>
      <ul className="insights">
        {rows.map((r) => {
          const Icon = r.icon
          return (
            <li key={r.title}>
              <span className={`chip-icon ${r.tone}`}>
                <Icon size={16} strokeWidth={2.2} aria-hidden />
              </span>
              <div className="ins-text">
                <div className="ins-head">
                  <span>{r.title}</span>
                  <strong>{r.value}</strong>
                </div>
                {r.sub && <div className="muted small">{r.sub}</div>}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Sparråd räknat på din egen förbrukning och de senaste veckornas priser. */
export function SavingTip({ s }: { s: Stats }) {
  if (!s.tip) return null
  const { from, to, perKwh, save } = s.tip
  return (
    <section className="card tip-card">
      <span className="chip-icon yellow">
        <Lightbulb size={16} strokeWidth={2.2} aria-hidden />
      </span>
      <div>
        <strong>
          Flytta tunga maskiner från {h2(from)}:00 till {h2(to)}:00
        </strong>
        <p className="muted small">
          Klockan {h2(from)} kostar din el mest. Varje kWh du flyttar sparar ungefär {kr(perKwh)} kr. En tvätt med tork sparar då runt {Math.round(save)} kr per gång, eller cirka {Math.round(save * 8)} kr i månaden om du kör två gånger i veckan.
        </p>
      </div>
    </section>
  )
}

/** Veckomönster: vilka timmar och dagar huset drar mest, snitt för fyra veckor. */
export function UsageHeatmap({ s }: { s: Stats }) {
  const [sel, setSel] = useState<[number, number] | null>(null)
  const max = Math.max(0.01, ...s.heat.flat())
  const today = (new Date().getDay() + 6) % 7
  const shown = sel ?? (() => {
    // Visa dygnets tyngsta timme som utgångsläge
    let best: [number, number] = [0, 0]
    s.heat.forEach((row, d) => row.forEach((v, h) => v > s.heat[best[0]][best[1]] && (best = [d, h])))
    return best
  })()
  const [d, h] = shown
  return (
    <section className="card">
      <h2>När huset använder el</h2>
      <p className="muted small heat-read">
        <strong className="heat-strong">
          {DAYS[d][0].toUpperCase() + DAYS[d].slice(1)} {h2(h)}–{h2((h + 1) % 24)}
        </strong>{' '}
        {s.heat[d][h].toLocaleString('sv-SE', { maximumFractionDigits: 1 })} kWh i snitt
      </p>
      <div className="heat" role="img" aria-label="Förbrukning per veckodag och timme, snitt för de senaste fyra veckorna">
        {s.heat.map((row, di) => (
          <div key={di} className={`heat-row ${di === today ? 'is-today' : ''}`}>
            <span className="heat-day">{DAYS[di]}</span>
            {row.map((v, hi) => (
              <button
                key={hi}
                className={`heat-cell ${di === d && hi === h ? 'sel' : ''}`}
                style={{ opacity: 0.12 + 0.88 * (v / max) }}
                onClick={() => setSel([di, hi])}
                onMouseEnter={() => setSel([di, hi])}
                aria-label={`${DAYS[di]} ${h2(hi)}: ${v.toFixed(1)} kWh`}
              />
            ))}
          </div>
        ))}
        <div className="heat-row heat-axis">
          <span className="heat-day" />
          {Array.from({ length: 24 }, (_, i) => (
            <span key={i}>{i % 6 === 0 ? h2(i) : ''}</span>
          ))}
        </div>
      </div>
    </section>
  )
}
