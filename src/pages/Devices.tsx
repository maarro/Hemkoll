import { useState } from 'react'
import { useHass } from '../ha/HassProvider'
import { computers, mediaKind, mediaPlayers, plugs } from '../ha/selectors'
import { ComputerTile, MediaTile, PlugTile } from '../components/Tiles'
import { MediaDetail } from '../components/MediaDetail'

export function Devices() {
  const { entities } = useHass()
  const [open, setOpen] = useState<string | null>(null)
  const p = plugs(entities)
  const m = mediaPlayers(entities)
  const speakers = m.filter((e) => mediaKind(e) === 'speaker')
  const screens = m.filter((e) => mediaKind(e) !== 'speaker')
  const c = computers(entities)
  const tiles = (list: typeof m) => list.map((e) => <MediaTile key={e.entity_id} entity={e} onOpen={() => setOpen(e.entity_id)} />)

  return (
    <div className="stack">
      <section className="card">
        <h2>Högtalare</h2>
        {speakers.length ? tiles(speakers) : <p className="muted">Inga högtalare hittade.</p>}
      </section>
      <section className="card">
        <h2>TV &amp; spel</h2>
        {screens.length ? tiles(screens) : <p className="muted">Inga TV-apparater hittade.</p>}
      </section>
      <section className="card">
        <h2>Uttag</h2>
        {p.length ? p.map((e) => <PlugTile key={e.entity_id} entity={e} />) : <p className="muted">Inga uttag hittade.</p>}
      </section>
      <section className="card">
        <h2>Datorer</h2>
        {c.length ? (
          c.map((e) => <ComputerTile key={e.entity_id} entity={e} />)
        ) : (
          <p className="muted">Lägg till Wake-on-LAN i Home Assistant för att väcka datorerna härifrån.</p>
        )}
      </section>
      {open && <MediaDetail entityId={open} onClose={() => setOpen(null)} />}
    </div>
  )
}
