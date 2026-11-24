import { BatteryLow, CircleCheck, LockOpen, WifiOff, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { config } from '../config'
import { useHass } from '../ha/HassProvider'
import { domainOf, lowBatteries, nameOf, network } from '../ha/selectors'
import { hhmm, kr, priceStats, usePrices } from '../ha/usePrices'

type Alert = { id: string; tone: 'warn' | 'good' | 'info'; icon: LucideIcon; text: string; action?: { label: string; run: () => void } }

/** "Just nu": det som är värt att veta utan att leta. Visar inget när allt är lugnt. */
export function Alerts() {
  const { entities, callService, getLogbook, status } = useHass()
  const { prices } = usePrices()
  // Vitvaror som blivit klara: läses från logboken, så att en omstart av HA inte ger falska "klar".
  const [done, setDone] = useState<Record<string, number>>({})
  const runIds = config.appliances.map((a) => a.running).join(',')
  useEffect(() => {
    if (status !== 'connected' && status !== 'demo') return
    let alive = true
    const load = () =>
      getLogbook(new Date(Date.now() - 2 * 3600_000), runIds.split(','))
        .then((ev) => {
          if (!alive) return
          const d: Record<string, number> = {}
          for (const e of ev) if (e.state === 'off' && e.when > (d[e.entity_id] ?? 0)) d[e.entity_id] = e.when
          setDone(d)
        })
        .catch(() => undefined)
    load()
    const t = setInterval(load, 60_000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [getLogbook, status, runIds])
  const alerts: Alert[] = []
  const now = Date.now()

  // Olåsta lås
  for (const e of Object.values(entities)) {
    if (domainOf(e.entity_id) !== 'lock' || e.state !== 'unlocked') continue
    const since = new Date(e.last_changed).getTime()
    alerts.push({
      id: e.entity_id,
      tone: 'warn',
      icon: LockOpen,
      text: `${nameOf(e)} är olåst${now - since > 60_000 ? ` sedan ${hhmm(since)}` : ''}`,
      action: { label: 'Lås', run: () => callService('lock', 'lock', {}, { entity_id: e.entity_id }) },
    })
  }

  // Internet nere
  const net = network(entities)
  if (net && !net.online && !net.unknown) alerts.push({ id: 'net', tone: 'warn', icon: WifiOff, text: 'Internet är nere. Enheter i hemmet fungerar, men inte utifrån.' })

  // Lågt batteri
  const low = lowBatteries(entities)
  if (low.length)
    alerts.push({
      id: 'battery',
      tone: 'warn',
      icon: BatteryLow,
      text:
        low.length === 1
          ? `Byt batteri i ${nameOf(low[0].e).replace(/ ?batteri$/i, '')}, ${Math.round(low[0].level)} % kvar`
          : `Lågt batteri i ${low.length} enheter: ${low.map((b) => nameOf(b.e).replace(/ ?batteri$/i, '')).join(', ')}`,
    })

  // Vitvaror som blivit klara senaste två timmarna
  for (const a of config.appliances) {
    const t = done[a.running]
    if (t && entities[a.running]?.state === 'off') alerts.push({ id: a.running, tone: 'good', icon: CircleCheck, text: `${a.name} klar ${hhmm(t)}` })
  }

  // Elpriset
  const st = priceStats(prices, 2)
  if (st?.now !== undefined) {
    const cheapAt = st.best >= 0 ? ` Billigast ${hhmm(prices[st.best].start)}.` : ''
    if (st.now > st.avg * 1.35)
      alerts.push({ id: 'price', tone: 'warn', icon: TrendingUp, text: `Dyr el just nu, ${kr(st.now)} kr/kWh.${cheapAt}` })
    else if (st.now < st.avg * 0.7)
      alerts.push({ id: 'price', tone: 'good', icon: TrendingDown, text: `Billig el just nu, ${kr(st.now)} kr/kWh. Bra läge för disk och tvätt.` })
  }

  if (!alerts.length) return null
  return (
    <section className="alerts">
      {alerts.map((a) => (
        <div key={a.id} className={`alert ${a.tone}`}>
          <a.icon size={18} strokeWidth={1.9} aria-hidden />
          <span className="alert-text">{a.text}</span>
          {a.action && (
            <button className="btn small" onClick={a.action.run}>
              {a.action.label}
            </button>
          )}
        </div>
      ))}
    </section>
  )
}
