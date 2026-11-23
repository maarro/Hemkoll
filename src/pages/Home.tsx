import { config } from '../config'
import { useHass } from '../ha/HassProvider'
import { num, tibber } from '../ha/selectors'
import { Alerts } from '../components/Alerts'
import { EntityTile } from '../components/EntityTile'
import { Scenes } from '../components/Scenes'
import { watts } from '../components/Tiles'
import { useFavorites } from '../ui/favorites'

/** Startsidan: det vanligaste ett tryck bort. */
export function Home({ goEnergy }: { goEnergy: () => void }) {
  const { entities } = useHass()
  const favs = useFavorites().map((id) => entities[id]).filter(Boolean)
  const t = tibber(entities)
  const power = num(t.power)
  const price = num(t.price)
  const appliances = config.appliances.filter((a) => entities[a.power] && entities[a.running]?.state === 'on')

  return (
    <div className="stack">
      <button className="card strip" onClick={goEnergy}>
        <span>
          <span className="muted small">Huset drar</span> <strong>{watts(power)}</strong>
        </span>
        <span>
          <span className="muted small">Elpris</span>{' '}
          <strong>{price !== undefined ? price.toLocaleString('sv-SE', { maximumFractionDigits: 2 }) : '–'}</strong>
          <span className="muted small"> kr/kWh</span>
        </span>
        <span className="chev" aria-hidden>
          ›
        </span>
      </button>

      <Alerts />

      <Scenes />

      {appliances.map((a) => (
        <section key={a.power} className="card washer running">
          <span className="washer-icon" aria-hidden>
            {a.icon}
          </span>
          <div className="tile-main">
            <div className="tile-name">{a.name}</div>
            <div className="muted small">
              {a.verb} · {watts(num(entities[a.power]))}
            </div>
          </div>
        </section>
      ))}

      <section className="card">
        <h2>Favoriter</h2>
        {favs.length ? (
          favs.map((e) => <EntityTile key={e.entity_id} entity={e} />)
        ) : (
          <p className="muted small">Håll inne på en enhet under Rum för att fästa den här.</p>
        )}
      </section>
    </div>
  )
}
