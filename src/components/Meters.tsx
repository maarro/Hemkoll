import { Coffee, Lamp, Monitor, Plug, Printer, Tv, WashingMachine, Wind, type LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useHass } from '../ha/HassProvider'
import { meters } from '../ha/selectors'
import { kr, usePrices } from '../ha/usePrices'
import { Sheet } from './Sheets'

type Row = { t: number; kwh: number }
type Meter = ReturnType<typeof meters>[number]

const kwhFmt = (v: number) =>
  v < 0.1 ? `${Math.round(v * 1000)} Wh` : `${v.toLocaleString('sv-SE', { maximumFractionDigits: v < 10 ? 2 : 1 })} kWh`
const wFmt = (w: number) => (w >= 1000 ? `${(w / 1000).toLocaleString('sv-SE', { maximumFractionDigits: 1 })} kW` : `${Math.round(w)} W`)
const meterIcon = (n: string): LucideIcon =>
  /tvätt|wash/i.test(n) ? WashingMachine : /tork|dryer/i.test(n) ? Wind : /tv|bänk/i.test(n) ? Tv : /lamp|ljus/i.test(n) ? Lamp
  : /kaffe|coffee/i.test(n) ? Coffee : /skrivare|bambu|printer/i.test(n) ? Printer : /dator|pc|skärm/i.test(n) ? Monitor : Plug
const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

/** Hämtar idag per timme (från 5-minutersstatistik, så pågående timme kommer med) och 30 dagar per dag. */
function useMeterData(ids: string[]) {
  const { getEnergy, getUsage, status } = useHass()
  const [today, setToday] = useState<Record<string, Row[]>>({})
  const [days, setDays] = useState<Record<string, Row[]>>({})
  const [dayPrice, setDayPrice] = useState<Record<number, number>>({})
  const key = ids.join(',')

  useEffect(() => {
    if ((status !== 'connected' && status !== 'demo') || !key) return
    let alive = true
    const list = key.split(',')
    const load = () => {
      getEnergy(list, startOfDay(), '5minute')
        .then((r) => {
          if (!alive) return
          // Slå ihop till timmar
          const hours: Record<string, Row[]> = {}
          for (const [id, rows] of Object.entries(r)) {
            const m = new Map<number, number>()
            for (const x of rows) {
              const h = new Date(x.t).setMinutes(0, 0, 0)
              m.set(h, (m.get(h) ?? 0) + x.kwh)
            }
            hours[id] = [...m.entries()].map(([t, kwh]) => ({ t, kwh })).sort((a, b) => a.t - b.t)
          }
          setToday(hours)
        })
        .catch(() => undefined)
    }
    const since = startOfDay(new Date(Date.now() - 29 * 86400_000))
    getEnergy(list, since, 'day')
      .then((r) => alive && setDays(r))
      .catch(() => undefined)
    // Dagens snittpris per dag från Tibber (kostnad delat med förbrukning)
    getUsage(since, 'day')
      .then((u) => {
        if (!alive) return
        const p: Record<number, number> = {}
        for (const d of u) if (d.cost !== undefined && d.kwh > 0) p[startOfDay(new Date(d.t)).getTime()] = d.cost / d.kwh
        setDayPrice(p)
      })
      .catch(() => undefined)
    load()
    const t = setInterval(load, 5 * 60_000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [getEnergy, getUsage, status, key])

  return { today, days, dayPrice }
}

/** Pris för en viss timme idag, snitt av timmens kvartspriser. */
function useHourPrice() {
  const { prices } = usePrices()
  return useMemo(() => {
    const m = new Map<number, number[]>()
    for (const p of prices) {
      const h = new Date(p.start).setMinutes(0, 0, 0)
      m.set(h, [...(m.get(h) ?? []), p.price])
    }
    const avg = prices.length ? prices.reduce((s, p) => s + p.price, 0) / prices.length : undefined
    return { at: (t: number) => { const l = m.get(t); return l ? l.reduce((a, b) => a + b, 0) / l.length : avg }, avg }
  }, [prices])
}

/** Uttagen med energimätning: vad de drar nu, idag och de senaste 30 dagarna. */
export function Meters() {
  const { entities, deviceOf } = useHass()
  const list = meters(entities, deviceOf)
  const ids = list.map((m) => m.energy!.entity_id)
  const { today, days, dayPrice } = useMeterData(ids)
  const price = useHourPrice()
  const [open, setOpen] = useState<string | null>(null)

  if (!list.length)
    return (
      <section className="card">
        <h2>Uttag och apparater</h2>
        <p className="muted">Inga uttag med energimätning hittades ännu.</p>
      </section>
    )

  const todayOf = (m: Meter) => {
    const rows = today[m.energy!.entity_id] ?? []
    const kwh = rows.reduce((s, r) => s + r.kwh, 0)
    const cost = rows.reduce((s, r) => s + r.kwh * (price.at(r.t) ?? 0), 0)
    return { rows, kwh, cost }
  }
  const sorted = [...list].sort((a, b) => todayOf(b).kwh - todayOf(a).kwh || b.watts - a.watts)
  const maxToday = Math.max(0.001, ...sorted.map((m) => todayOf(m).kwh))
  const sel = list.find((m) => m.id === open)

  return (
    <section className="card">
      <h2>Uttag och apparater</h2>
      <ul className="meters">
        {sorted.map((m) => {
          const t = todayOf(m)
          const Icon = meterIcon(m.name)
          const on = m.watts > 3
          return (
            <li key={m.id}>
              <button className="meter" onClick={() => setOpen(m.id)}>
                <span className={`meter-icon ${on ? 'on' : ''}`}>
                  <Icon size={18} strokeWidth={2} aria-hidden />
                </span>
                <span className="meter-text">
                  <span className="meter-name">{m.name}</span>
                  <span className="meter-sub">
                    Idag {kwhFmt(t.kwh)}
                    {t.cost > 0.005 ? `, ${kr(t.cost)} kr` : ''}
                  </span>
                  <span className="meter-bar">
                    <span style={{ width: `${(t.kwh / maxToday) * 100}%` }} />
                  </span>
                </span>
                <span className={`meter-now ${on ? 'on' : ''}`}>{wFmt(m.watts)}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {sel && (
        <MeterSheet
          m={sel}
          today={todayOf(sel)}
          days={days[sel.energy!.entity_id] ?? []}
          dayPrice={dayPrice}
          fallbackPrice={price.avg}
          hourPrice={price.at}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  )
}

function MeterSheet({
  m,
  today,
  days,
  dayPrice,
  fallbackPrice,
  hourPrice,
  onClose,
}: {
  m: Meter
  today: { rows: Row[]; kwh: number; cost: number }
  days: Row[]
  dayPrice: Record<number, number>
  fallbackPrice?: number
  hourPrice: (t: number) => number | undefined
  onClose: () => void
}) {
  const [view, setView] = useState<'idag' | 'manad'>('idag')
  const [pick, setPick] = useState<number | null>(null)

  // Idag: alla 24 timmar, tomma blir noll
  const dayStart = startOfDay().getTime()
  const hours = Array.from({ length: 24 }, (_, h) => {
    const t = dayStart + h * 3600_000
    const r = today.rows.find((x) => x.t === t)
    return { t, kwh: r?.kwh ?? 0, label: String(h).padStart(2, '0'), future: t > Date.now() }
  })
  // 30 dagar
  const dayRows = days.map((d) => {
    const k = startOfDay(new Date(d.t)).getTime()
    const p = dayPrice[k] ?? fallbackPrice ?? 0
    return { t: d.t, kwh: d.kwh, cost: d.kwh * p, label: new Date(d.t).getDate().toString(), future: false }
  })
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
  const thisMonth = dayRows.filter((d) => d.t >= monthStart)
  const mKwh = thisMonth.reduce((s, d) => s + d.kwh, 0)
  const mCost = thisMonth.reduce((s, d) => s + d.cost, 0)
  const avgDay = dayRows.length ? dayRows.reduce((s, d) => s + d.kwh, 0) / dayRows.length : 0
  const yearCost = avgDay * 365 * (fallbackPrice ?? 0)

  const bars = view === 'idag' ? hours : dayRows
  const max = Math.max(0.001, ...bars.map((b) => b.kwh))
  const shown = pick !== null && bars[pick] ? bars[pick] : undefined
  const readout = shown
    ? view === 'idag'
      ? `${shown.label}:00, ${kwhFmt(shown.kwh)}${hourPrice(shown.t) ? `, ${kr(shown.kwh * (hourPrice(shown.t) ?? 0))} kr` : ''}`
      : `${new Date(shown.t).toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })}, ${kwhFmt(shown.kwh)}, ${kr((shown as (typeof dayRows)[number]).cost)} kr`
    : view === 'idag'
      ? 'Tryck på en stapel för att se timmen'
      : 'Tryck på en stapel för att se dagen'

  return (
    <Sheet title={m.name} sub={m.watts > 3 ? `Drar ${wFmt(m.watts)} just nu` : 'Står i viloläge eller är av'} onClose={onClose}>
      <div className="segmented" role="tablist">
        <button role="tab" aria-selected={view === 'idag'} className={view === 'idag' ? 'sel' : ''} onClick={() => { setView('idag'); setPick(null) }}>
          Idag
        </button>
        <button role="tab" aria-selected={view === 'manad'} className={view === 'manad' ? 'sel' : ''} onClick={() => { setView('manad'); setPick(null) }}>
          30 dagar
        </button>
      </div>

      <div className="facts">
        {view === 'idag' ? (
          <>
            <div>
              <dt>Idag</dt>
              <dd>{kwhFmt(today.kwh)}</dd>
            </div>
            <div>
              <dt>Kostnad idag</dt>
              <dd>
                {kr(today.cost)} <span className="unit">kr</span>
              </dd>
            </div>
          </>
        ) : (
          <>
            <div>
              <dt>Den här månaden</dt>
              <dd>{kwhFmt(mKwh)}</dd>
            </div>
            <div>
              <dt>Kostnad i månaden</dt>
              <dd>
                {Math.round(mCost).toLocaleString('sv-SE')} <span className="unit">kr</span>
              </dd>
            </div>
            <div>
              <dt>Snitt per dag</dt>
              <dd>{kwhFmt(avgDay)}</dd>
            </div>
            <div>
              <dt>Ungefär per år</dt>
              <dd>
                {(Math.round(yearCost / 10) * 10).toLocaleString('sv-SE')} <span className="unit">kr</span>
              </dd>
            </div>
          </>
        )}
      </div>

      <div>
        <p className="muted small meter-readout">{readout}</p>
        <div className={`mbars ${view}`} role="img" aria-label={view === 'idag' ? 'Förbrukning per timme idag' : 'Förbrukning per dag, 30 dagar'}>
          {bars.map((b, i) => (
            <button
              key={b.t}
              className={`mbar ${pick === i ? 'sel' : ''} ${b.future ? 'future' : ''}`}
              onClick={() => setPick(i)}
              onMouseEnter={() => setPick(i)}
              aria-label={`${b.label}: ${kwhFmt(b.kwh)}`}
            >
              <span style={{ height: `${Math.max(b.kwh > 0 ? 3 : 0, (b.kwh / max) * 100)}%` }} />
            </button>
          ))}
        </div>
        <div className="mbars-axis">
          {view === 'idag'
            ? ['00', '06', '12', '18', '23'].map((l) => <span key={l}>{l}</span>)
            : [dayRows[0], dayRows[Math.floor(dayRows.length / 2)], dayRows[dayRows.length - 1]].filter(Boolean).map((d) => (
                <span key={d.t}>{new Date(d.t).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}</span>
              ))}
        </div>
      </div>
    </Sheet>
  )
}
