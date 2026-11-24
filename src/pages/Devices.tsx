import { useHass } from '../ha/HassProvider'
import { alarmPanel, computers, domainOf, mediaKind, mediaPlayers, plugs } from '../ha/selectors'
import { TileGrid } from '../components/EntityTile'
import type { HassEntity } from '../ha/types'

/** Alla enheter sorterade på typ – när rum saknas eller via "Visa alla enheter". */
export function Devices() {
  const { entities, noise } = useHass()
  const ok = (e: HassEntity) => !noise.has(e.entity_id)
  const m = mediaPlayers(entities).filter(ok)
  const alarm = alarmPanel(entities)
  const groups: [string, HassEntity[]][] = [
    ['Säkerhet', [...(alarm ? [alarm] : []), ...Object.values(entities).filter((e) => domainOf(e.entity_id) === 'lock' && ok(e))]],
    ['Högtalare', m.filter((e) => mediaKind(e) === 'speaker')],
    ['TV och spel', m.filter((e) => mediaKind(e) !== 'speaker')],
    ['Uttag och lampor', [...plugs(entities), ...Object.values(entities).filter((e) => ['light', 'fan'].includes(domainOf(e.entity_id)))].filter(ok)],
    ['Datorer', computers(entities)],
  ]
  return (
    <div className="stack">
      {groups
        .filter(([, list]) => list.length)
        .map(([title, list]) => (
          <section key={title}>
            <h2 className="section-title">{title}</h2>
            <TileGrid list={list} />
          </section>
        ))}
    </div>
  )
}
