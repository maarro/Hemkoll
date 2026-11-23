import { useHass } from '../ha/HassProvider'
import { computers, mediaKind, mediaPlayers, plugs, domainOf } from '../ha/selectors'
import { EntityTile } from '../components/EntityTile'

/** Alla enheter sorterade på typ – används när rum saknas eller via "Visa alla enheter". */
export function Devices() {
  const { entities, noise } = useHass()
  const ok = (id: string) => !noise.has(id)
  const p = plugs(entities).filter((e) => ok(e.entity_id))
  const m = mediaPlayers(entities).filter((e) => ok(e.entity_id))
  const speakers = m.filter((e) => mediaKind(e) === 'speaker')
  const screens = m.filter((e) => mediaKind(e) !== 'speaker')
  const c = computers(entities)
  const locks = Object.values(entities).filter((e) => domainOf(e.entity_id) === 'lock' && ok(e.entity_id))
  const section = (title: string, list: typeof m, empty: string) => (
    <section className="card">
      <h2>{title}</h2>
      {list.length ? list.map((e) => <EntityTile key={e.entity_id} entity={e} />) : <p className="muted">{empty}</p>}
    </section>
  )
  return (
    <div className="stack">
      {locks.length > 0 && section('Lås', locks, '')}
      {section('Högtalare', speakers, 'Inga högtalare hittade.')}
      {section('TV & spel', screens, 'Inga TV-apparater hittade.')}
      {section('Uttag', p, 'Inga uttag hittade.')}
      {section('Datorer', c, 'Lägg till Wake-on-LAN i Home Assistant för att väcka datorerna härifrån.')}
    </div>
  )
}
