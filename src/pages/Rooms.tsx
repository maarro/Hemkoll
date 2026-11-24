import { Armchair, Bath, Bed, Car, ChefHat, ChevronLeft, DoorOpen, House, Monitor, Package, Shirt, ToyBrick, Trees, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { config } from '../config'
import { useHass } from '../ha/HassProvider'
import { domainOf, nameOf, roomTemperature } from '../ha/selectors'
import type { HassEntity } from '../ha/types'
import { CONTROLLABLE, TileGrid } from '../components/EntityTile'
import { useUi } from '../ui/UiContext'
import { Devices } from './Devices'

const isActive = (e: HassEntity) => ['on', 'playing', 'paused', 'unlocked'].includes(e.state)
const ROOM_ICONS: [RegExp, LucideIcon][] = [
  [/vardag|living|tv-rum/i, Armchair],
  [/kök|kok|kitchen/i, ChefHat],
  [/sov|bed/i, Bed],
  [/kontor|office|arbets/i, Monitor],
  [/tvätt|laundry/i, Shirt],
  [/hall|entré/i, DoorOpen],
  [/bad|bath|wc|toa/i, Bath],
  [/barn|kid|lek/i, ToyBrick],
  [/garage/i, Car],
  [/ute|trädgård|altan|garden/i, Trees],
]
const iconFor = (name: string): LucideIcon => ROOM_ICONS.find(([re]) => re.test(name))?.[1] ?? House
const temp = (t?: number) => (t === undefined ? '' : `${t.toLocaleString('sv-SE', { maximumFractionDigits: 1 })}°`)

/** Rum från Home Assistant. Tryck på ett rum för att se och styra allt där. */
export function Rooms() {
  const { entities, areas, areaOf, noise, baseUrl } = useHass()
  const { openCamera } = useUi()
  const [open, setOpen] = useState<string | null>(null)
  const [all, setAll] = useState(false)

  const devices = Object.values(entities).filter(
    (e) => CONTROLLABLE.includes(domainOf(e.entity_id)) && !noise.has(e.entity_id) && !config.hidden.includes(e.entity_id),
  )
  const inRoom = (id: string | null) =>
    devices.filter((e) => (areaOf[e.entity_id] ?? null) === id).sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'sv'))
  const unassigned = inRoom(null)

  if (!areas.length || all)
    return (
      <div className="stack">
        {areas.length > 0 && (
          <button className="back" onClick={() => setAll(false)}>
            <ChevronLeft size={18} /> Alla rum
          </button>
        )}
        {!areas.length && (
          <p className="note">Inga rum i Home Assistant ännu. Lägg till rum under Inställningar, Områden, så sorteras allt här automatiskt.</p>
        )}
        <Devices />
      </div>
    )

  if (open !== null) {
    const area = areas.find((a) => a.id === open)
    const list = open === '__none' ? unassigned : inRoom(open)
    const cams = Object.values(entities).filter((e) => domainOf(e.entity_id) === 'camera' && areaOf[e.entity_id] === open)
    const t = area ? roomTemperature(entities, areaOf, area.id) : undefined
    const Icon = area ? iconFor(area.name) : Package
    return (
      <div className="stack">
        <button className="back" onClick={() => setOpen(null)}>
          <ChevronLeft size={18} /> Alla rum
        </button>
        <header className="room-head">
          <Icon size={26} strokeWidth={1.6} aria-hidden />
          <h2>{area?.name ?? 'Övrigt'}</h2>
          {t !== undefined && <span className="room-temp">{temp(t)}</span>}
        </header>
        {list.length ? <TileGrid list={list} /> : <p className="empty">Inget att styra här ännu.</p>}
        {cams.length > 0 && (
          <div className="cams">
            {cams.map((c) => {
              const pic = c.attributes.entity_picture as string | undefined
              return (
                <button key={c.entity_id} className="cam" onClick={() => openCamera(c.entity_id)}>
                  {pic && <img src={pic.startsWith('data:') ? pic : `${baseUrl}${pic}`} alt={`Bild från ${nameOf(c)}`} />}
                  <span className="cam-name">{nameOf(c)}</span>
                </button>
              )
            })}
          </div>
        )}
        <p className="hint">Håll inne på en ruta för att fästa den på Hem.</p>
      </div>
    )
  }

  const cards = [
    ...areas.map((a) => ({ id: a.id, name: a.name, Icon: iconFor(a.name), list: inRoom(a.id), t: roomTemperature(entities, areaOf, a.id) })),
    ...(unassigned.length ? [{ id: '__none', name: 'Övrigt', Icon: Package, list: unassigned, t: undefined }] : []),
  ].filter((c) => c.list.length || c.t !== undefined)

  return (
    <div className="stack">
      <div className="rooms">
        {cards.map((c) => {
          const active = c.list.filter(isActive).length
          return (
            <button key={c.id} className={`room-card ${active ? 'lit' : ''}`} onClick={() => setOpen(c.id)}>
              <span className="room-top">
                <c.Icon size={24} strokeWidth={1.6} aria-hidden />
                {c.t !== undefined && <span className="room-temp">{temp(c.t)}</span>}
              </span>
              <span className="room-name">{c.name}</span>
              <span className="room-sub">{active ? `${active} av ${c.list.length} på` : c.list.length ? 'Allt av' : 'Bara givare'}</span>
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
