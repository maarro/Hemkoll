import { useEffect, useState } from 'react'
import { config } from '../config'
import { useHass } from '../ha/HassProvider'
import { applianceIcon } from '../ui/icons'
import { bestStart, kr, usePrices, when } from '../ha/usePrices'

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

/** När lönar det sig att köra tvätt och tork? Räknat på dagens och morgondagens priser. */
export function LaundryPlanner() {
  const { entities } = useHass()
  const { ahead } = usePrices()
  const rows = config.appliances
    .filter((a) => entities[a.running]?.state !== 'on')
    .map((a) => ({ a, b: bestStart(ahead, a.hours, a.kwh) }))
    .filter((r): r is { a: (typeof config.appliances)[number]; b: NonNullable<ReturnType<typeof bestStart>> } => !!r.b)
  if (!rows.length) return null
  return (
    <section className="card">
      <h2>Bästa tid att tvätta</h2>
      <ul className="plan">
        {rows.map(({ a, b }) => {
          const Icon = applianceIcon(a.name)
          const save = b.costNow - b.cost
          return (
            <li key={a.name}>
              <Icon size={20} strokeWidth={1.75} aria-hidden />
              <div>
                <div className="plan-name">{a.name}</div>
                <div className="muted small">
                  {b.isNow || save < 0.2 ? `Kör gärna nu, ca ${kr(b.costNow)} kr` : `${kr(b.cost)} kr då, ${kr(b.costNow)} kr om du kör nu`}
                </div>
              </div>
              <span className="plan-when">{b.isNow || save < 0.2 ? 'Nu' : cap(when(b.start))}</span>
            </li>
          )
        })}
      </ul>
      <p className="muted small">Räknat på ett vanligt program. Morgondagens priser kommer vid lunch.</p>
    </section>
  )
}

/** Vad huset drar på natten när allt borde vara av, och vad det kostar på ett år. */
export function Standby() {
  const { getHourly, status } = useHass()
  const { prices } = usePrices()
  const [base, setBase] = useState<number | undefined>()
  useEffect(() => {
    if (status !== 'connected' && status !== 'demo') return
    getHourly(7 * 24)
      .then((rows) => {
        // Lägsta timmen mellan 01 och 05 varje natt, sedan medianen av nätterna
        const nights: Record<string, number> = {}
        for (const r of rows) {
          const d = new Date(r.t)
          if (d.getHours() < 1 || d.getHours() >= 5) continue
          const k = d.toDateString()
          nights[k] = Math.min(nights[k] ?? Infinity, r.kwh)
        }
        const v = Object.values(nights).sort((a, b) => a - b)
        setBase(v.length ? v[Math.floor(v.length / 2)] * 1000 : undefined)
      })
      .catch(() => undefined)
  }, [getHourly, status])
  if (base === undefined) return null
  const avg = prices.length ? prices.reduce((s, p) => s + p.price, 0) / prices.length : undefined
  const year = avg !== undefined ? (base / 1000) * 8760 * avg : undefined
  return (
    <section className="card standby">
      <h2>Standby på natten</h2>
      <div className="standby-row">
        <span className="big">{Math.round(base)} W</span>
        {year !== undefined && <span className="muted">ca {(Math.round(year / 100) * 100).toLocaleString('sv-SE')} kr om året till dagens pris</span>}
      </div>
      <p className="muted small">Det huset drar mitt i natten när allt borde vara av: kyl, frys, router, laddare och det som står i viloläge. Varje 10 W bort sparar ungefär {avg !== undefined ? Math.round(0.01 * 8760 * avg) : '–'} kr om året.</p>
    </section>
  )
}

/** Hur månaden slutar om resten går som hittills. */
export function monthForecast(monthCost: number | undefined) {
  if (monthCost === undefined) return undefined
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime()
  const done = (now.getTime() - start) / (end - start)
  if (done < 0.1) return undefined
  return monthCost / done
}
