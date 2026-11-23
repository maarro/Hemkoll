import { useState } from 'react'
import { useHass } from '../ha/HassProvider'
import { domainOf, nameOf } from '../ha/selectors'
import type { HassEntity } from '../ha/types'
import { CONTROLLABLE, EntityTile } from '../components/EntityTile'
import { Devices } from './Devices'
import { config } from '../config'

const isActive = (e: HassEntity) => ['on', 'playing', 'unlocked', 'paused', 'idle'].includes(e.state)
const roomIcon: [RegExp, string][] = [
  [/vardag|living/i, '🛋️'],
  [/kök|kok|kitchen/i, '🍳'],
  [/sov|bed/i, '🛏️'],
  [/kontor|office|arbets/i, '💻'],
  [/tvätt|laundry/i, '🧺'],
  [/hall|entré/i, '🚪'],
  [/bad|bath|wc|toa/i, '🛁'],
  [/barn|kid/i, '🧸'],
  [/garage/i, '🚗'],
  [/ute|trädgård|altan|garden/i, '🌳'],
]
const iconFor = (name: string, icon?: string) => icon ?? roomIcon.find(([re]) => re.test(name))?.[1] ?? '🏠'

/** Rum från Home Assistant. Tryck på ett rum för att se allt där. */
export function Rooms() {
  const { entities, areas, areaOf, noise } = useHass()
  const [open, setOpen] = useState<string | null>(null)
  const [all, setAll] = useState(false)

  const devices = Object.values(entities).filter(
    (e) => CONTROLLABLE.includes(domainOf(e.entity_id)) && !noise.has(e.entity_id) && !config.hidden.includes(e.entity_id),
  )
  const inRoom = (id: string | null) => devices.filter((e) => (areaOf[e.entity_id] ?? null) === id).sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'sv'))
  const unassigned = inRoom(null)

  if (!areas.length || all)
    return (
      <div className="stack">
        {areas.length > 0 && (
          <button className="btn wide" onClick={() => setAll(false)}>
            ‹ Tillbaka till rum
          </button>
        )}
        {!areas.length && (
          <p className="note small">
            Inga rum i Home Assistant ännu. Lägg till rum under Inställningar → Områden, så sorteras allt här automatiskt.
          </p>
        )}
        <Devices />
      </div>
    )

  if (open !== null) {
    const area = areas.find((a) => a.id === open)
    const list = open === '__none' ? unassigned : inRoom(open)
    return (
      <div className="stack">
        <button className="btn wide back" onClick={() => setOpen(null)}>
          ‹ Alla rum
        </button>
        <section className="card">
          <h2>
            {area ? `${iconFor(area.name, area.icon)} ${area.name}` : 'Övrigt'}
          </h2>
          {list.length ? list.map((e) => <EntityTile key={e.entity_id} entity={e} />) : <p className="muted">Inget att styra här.</p>}
        </section>
        <p className="muted small center">Håll inne på en enhet för att fästa den på startsidan.</p>
      </div>
    )
  }

  const cards = [
    ...areas.map((a) => ({ id: a.id, name: a.name, icon: iconFor(a.name, a.icon), list: inRoom(a.id) })),
    ...(unassigned.length ? [{ id: '__none', name: 'Övrigt', icon: '📦', list: unassigned }] : []),
  ].filter((c) => c.list.length)

  return (
    <div className="stack">
      <div className="rooms">
        {cards.map((c) => {
          const active = c.list.filter(isActive).length
          return (
            <button key={c.id} className={`room-card ${active ? 'on' : ''}`} onClick={() => setOpen(c.id)}>
              <span className="room-icon" aria-hidden>
                {c.icon}
              </span>
              <span className="room-name">{c.name}</span>
              <span className="muted small">
                {active ? `${active} av ${c.list.length} på` : `${c.list.length} ${c.list.length === 1 ? 'enhet' : 'enheter'}`}
              </span>
            </button>
          )
        })}
      </div>
      <button className="btn wide" onClick={() => setAll(true)}>
        Visa alla enheter
      </button>
    </div>
  )
}
