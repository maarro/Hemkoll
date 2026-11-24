import { CalendarDays, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useHass } from '../ha/HassProvider'
import { calendars, wastePickups } from '../ha/selectors'
import type { CalEvent } from '../ha/types'
import { hhmm } from '../ha/usePrices'

const dayWord = (d: number) => (d === 0 ? 'idag' : d === 1 ? 'i morgon' : `om ${d} dagar`)

/** Idag: familjekalendern och nästa sophämtning. Syns bara när det finns något. */
export function Today() {
  const { entities, getEvents, status } = useHass()
  const cals = calendars(entities).map((e) => e.entity_id)
  const key = cals.join(',')
  const [events, setEvents] = useState<CalEvent[]>([])

  useEffect(() => {
    if ((status !== 'connected' && status !== 'demo') || !key) return
    let alive = true
    const load = () => {
      const start = new Date()
      const end = new Date()
      end.setDate(end.getDate() + 1)
      end.setHours(23, 59, 0, 0)
      getEvents(key.split(','), start, end)
        .then((ev) => alive && setEvents(ev))
        .catch(() => undefined)
    }
    load()
    const t = setInterval(load, 15 * 60_000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [getEvents, status, key])

  const todayStr = new Date().toDateString()
  const isToday = (e: CalEvent) => new Date(e.allDay ? `${e.start}T00:00` : e.start).toDateString() === todayStr
  const today = events.filter(isToday)
  // Inget kvar idag: visa morgondagens två första
  const list = today.length ? today : events.slice(0, 2)
  const waste = wastePickups(entities).filter((w) => w.days <= 2)

  if (!list.length && !waste.length) return null
  return (
    <section className="today">
      {list.map((e, i) => (
        <div key={i} className="today-row">
          <CalendarDays size={16} strokeWidth={1.8} aria-hidden />
          <span className="today-time">{e.allDay ? (isToday(e) ? 'Hela dagen' : 'I morgon') : `${isToday(e) ? '' : 'I morgon '}${hhmm(e.start)}`}</span>
          <span className="today-what">{e.summary}</span>
        </div>
      ))}
      {waste.map((w) => (
        <div key={w.name} className="today-row">
          <Trash2 size={16} strokeWidth={1.8} aria-hidden />
          <span className="today-time">{dayWord(w.days)[0].toUpperCase() + dayWord(w.days).slice(1)}</span>
          <span className="today-what">{w.name}</span>
        </div>
      ))}
    </section>
  )
}
