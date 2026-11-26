import { BatteryLow, CircleCheck, Download, House, LockOpen, Moon, ShieldOff, WifiOff, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { config } from '../config'
import { useHass } from '../ha/HassProvider'
import { alarmPanel, domainOf, everyoneAway, forgottenOn, lowBatteries, nameOf, network, updates } from '../ha/selectors'
import { sceneButtons } from '../ha/scenes'
import { useUi } from '../ui/UiContext'
import { hhmm, kr, priceStats, usePrices } from '../ha/usePrices'

type Alert = { id: string; tone: 'warn' | 'good' | 'info'; icon: LucideIcon; text: string; action?: { label: string; run: () => void } }

/** "Just nu": det som är värt att veta utan att leta. Visar inget när allt är lugnt. */
export function Alerts() {
  const { entities, callService, getLogbook, status, baseUrl, noise } = useHass()
  const { openAlarm, toast } = useUi()
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

  const hour = new Date().getHours()
  const evening = hour >= config.eveningFrom || hour < 5
  const away = everyoneAway(entities)
  const unlocked = Object.values(entities).filter((e) => domainOf(e.entity_id) === 'lock' && e.state === 'unlocked')
  const alarm = alarmPanel(entities)
  const night = sceneButtons(entities, callService, status === 'demo', noise).find((s) => /natt|sov|night/i.test(s.name))

  // Kvällsrutin: någon är hemma, det är sent och dörren är olåst eller larmet av
  if (evening && !away && night && (unlocked.length || alarm?.state === 'disarmed')) {
    const what = [unlocked.length ? `${unlocked.map((e) => nameOf(e).toLowerCase()).join(' och ')} är olåst` : '', alarm?.state === 'disarmed' ? 'larmet är av' : '']
      .filter(Boolean)
      .join(' och ')
    alerts.push({
      id: 'evening',
      tone: 'info',
      icon: Moon,
      text: `Dags för natten? ${what[0].toUpperCase()}${what.slice(1)}.`,
      action: unlocked.length
        ? { label: night.name, run: () => night.run().then(() => toast(`${night.name} klar`)) }
        : alarm
          ? { label: 'Larma', run: () => openAlarm(alarm.entity_id) }
          : undefined,
    })
  } else {
    // Olåsta lås
    for (const e of unlocked) {
      const since = new Date(e.last_changed).getTime()
      alerts.push({
        id: e.entity_id,
        tone: 'warn',
        icon: LockOpen,
        text: `${nameOf(e)} är olåst${now - since > 60_000 ? ` sedan ${hhmm(since)}` : ''}`,
        action: { label: 'Lås', run: () => callService('lock', 'lock', {}, { entity_id: e.entity_id }) },
      })
    }
  }

  // Alla har gått: larmet är av, eller något står på
  if (away) {
    if (alarm?.state === 'disarmed')
      alerts.push({ id: 'away-alarm', tone: 'warn', icon: ShieldOff, text: 'Alla har gått men larmet är av', action: { label: 'Larma', run: () => openAlarm(alarm.entity_id) } })
    const on = forgottenOn(entities)
    if (on.length)
      alerts.push({
        id: 'away-on',
        tone: 'warn',
        icon: House,
        text: `Ingen är hemma men ${on.length === 1 ? `${nameOf(on[0])} är på` : `${on.length} saker är på: ${on.map((e) => nameOf(e)).join(', ')}`}`,
        action: {
          label: 'Stäng av',
          run: () => callService('homeassistant', 'turn_off', {}, { entity_id: on.map((e) => e.entity_id) }).then(() => toast('Avstängt')),
        },
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

  // Uppdateringar
  const ups = updates(entities)
  if (ups.length)
    alerts.push({
      id: 'updates',
      tone: 'info',
      icon: Download,
      text: ups.length === 1 ? `Ny version finns för ${String(ups[0].attributes.title ?? nameOf(ups[0]))}` : `${ups.length} uppdateringar finns`,
      action: baseUrl ? { label: 'Visa', run: () => window.open(`${baseUrl}/config/updates`, '_blank') } : undefined,
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
