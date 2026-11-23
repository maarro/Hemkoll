import { useEffect, useState } from 'react'
import { config } from '../config'
import { useHass } from '../ha/HassProvider'
import { domainOf } from '../ha/selectors'
import type { LogEvent } from '../ha/types'
import { hhmm } from '../ha/usePrices'

type Row = { when: number; icon: string; text: string; tone: 'warn' | 'good' | 'info' }

/** Översätter logbokens tillståndsändringar till begripliga rader. */
function describe(e: LogEvent, nameOf: (id: string) => string): Row | null {
  const app = config.appliances.find((a) => a.running === e.entity_id)
  if (app)
    return e.state === 'on'
      ? { when: e.when, icon: app.icon, text: `${app.name} startade`, tone: 'info' }
      : { when: e.when, icon: app.icon, text: `${app.name} klar`, tone: 'good' }
  const d = domainOf(e.entity_id)
  const name = nameOf(e.entity_id) || e.name
  if (d === 'lock') {
    if (e.state === 'unlocked') return { when: e.when, icon: '🔓', text: `${name} låstes upp`, tone: 'warn' }
    if (e.state === 'locked') return { when: e.when, icon: '🔒', text: `${name} låstes`, tone: 'info' }
    if (e.state === 'jammed') return { when: e.when, icon: '⚠️', text: `${name} har fastnat`, tone: 'warn' }
  }
  if (d === 'alarm_control_panel') {
    const t: Record<string, string> = { armed_away: 'Larmet på (borta)', armed_home: 'Larmet på (hemma)', armed_night: 'Larmet på (natt)', disarmed: 'Larmet av', triggered: 'LARMET GICK' }
    if (t[e.state]) return { when: e.when, icon: e.state === 'triggered' ? '🚨' : '🛡️', text: t[e.state], tone: e.state === 'triggered' ? 'warn' : 'info' }
  }
  if (d === 'binary_sensor' && e.state === 'on') return { when: e.when, icon: '🚪', text: `${name} öppnades`, tone: 'info' }
  return null
}

const dayLabel = (t: number) => {
  const d = new Date(t)
  const today = new Date()
  const y = new Date(today.getTime() - 86_400_000)
  if (d.toDateString() === today.toDateString()) return 'Idag'
  if (d.toDateString() === y.toDateString()) return 'Igår'
  return d.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'short' })
}

/** Händelser senaste dygnen: tvätt, lås, larm och dörrar. */
export function Events() {
  const { entities, getLogbook, status } = useHass()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [failed, setFailed] = useState(false)

  const ids = [
    ...config.appliances.map((a) => a.running),
    ...Object.keys(entities).filter(
      (id) =>
        ['lock', 'alarm_control_panel'].includes(domainOf(id)) ||
        (domainOf(id) === 'binary_sensor' && ['door', 'garage_door'].includes(entities[id]?.attributes.device_class as string)),
    ),
  ]
  const idKey = ids.sort().join(',')

  useEffect(() => {
    if (status !== 'connected' && status !== 'demo') return
    let alive = true
    const load = () =>
      getLogbook(new Date(Date.now() - 2 * 86_400_000), idKey ? idKey.split(',') : [])
        .then((evts) => {
          if (!alive) return
          const nameOf = (id: string) => (entities[id]?.attributes.friendly_name as string) ?? ''
          setRows(
            evts
              .map((e) => describe(e, nameOf))
              .filter((r): r is Row => r !== null)
              .sort((a, b) => b.when - a.when),
          )
          setFailed(false)
        })
        .catch(() => alive && setFailed(true))
    load()
    const t = setInterval(load, 60_000)
    return () => {
      alive = false
      clearInterval(t)
    }
    // entities ändras hela tiden; namnen räcker att läsa vid varje hämtning
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getLogbook, status, idKey])

  if (failed) return <p className="note small">Kunde inte hämta händelser från Home Assistant.</p>
  if (!rows) return <p className="muted">Hämtar händelser…</p>
  if (!rows.length)
    return <p className="note small">Inga händelser senaste två dygnen. Här visas tvätt och tork, lås, larm och dörrar när de finns i Home Assistant.</p>

  let last = ''
  return (
    <div className="stack">
      <section className="card">
        <ul className="events">
          {rows.map((r, i) => {
            const day = dayLabel(r.when)
            const head = day !== last
            last = day
            return (
              <li key={i}>
                {head && <div className="event-day">{day}</div>}
                <div className={`event ${r.tone}`}>
                  <span className="event-time">{hhmm(r.when)}</span>
                  <span aria-hidden>{r.icon}</span>
                  <span>{r.text}</span>
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
