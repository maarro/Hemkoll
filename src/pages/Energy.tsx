import { config } from '../config'
import { useHass } from '../ha/HassProvider'
import { consumers, nameOf, num, tibber } from '../ha/selectors'
import { PriceChart } from '../components/PriceChart'
import { watts } from '../components/Tiles'

/** Energi: effekt, kostnad, elpris och vad som drar mest. */
export function Energy() {
  const { entities } = useHass()
  const t = tibber(entities)
  const power = num(t.power)
  const price = num(t.price)
  const costPerHour = power !== undefined && price !== undefined ? (power / 1000) * price : undefined
  const top = consumers(entities).filter((c) => c.watts > 0).slice(0, 6)
  const topMax = Math.max(1, ...top.map((c) => c.watts))

  const appliances = config.appliances.filter((a) => entities[a.power])


  return (
    <div className="stack">
      <section className="card hero">
        <div className="hero-grid">
          <div>
            <div className="muted small">Huset drar just nu</div>
            <div className="huge">{watts(power)}</div>
            <div className="muted small">
              {costPerHour !== undefined
                ? `≈ ${costPerHour.toLocaleString('sv-SE', { maximumFractionDigits: 2 })} kr/timme`
                : 'Koppla in Tibber Pulse för realtid'}
            </div>
          </div>
          <div className="hero-side">
            <div>
              <div className="muted small">Idag</div>
              <div className="mid">
                {num(t.cost)?.toLocaleString('sv-SE', { maximumFractionDigits: 1 }) ?? '–'} <span className="unit">kr</span>
              </div>
            </div>
            <div>
              <div className="muted small">Förbrukat</div>
              <div className="mid">
                {num(t.consumption)?.toLocaleString('sv-SE', { maximumFractionDigits: 1 }) ?? '–'} <span className="unit">kWh</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {appliances.length > 0 && (
        <div className="appliances">
          {appliances.map((a) => {
            const running = entities[a.running]?.state === 'on'
            return (
              <section key={a.power} className={`card washer ${running ? 'running' : ''}`}>
                <span className="washer-icon" aria-hidden>
                  {a.icon}
                </span>
                <div className="tile-main">
                  <div className="tile-name">{a.name}</div>
                  <div className="muted small">{running ? `${a.verb} · ${watts(num(entities[a.power]))}` : 'Klar / ledig'}</div>
                </div>
              </section>
            )
          })}
        </div>
      )}

      <section className="card">
        <h2>Elpris idag</h2>
        <PriceChart />
      </section>

      <section className="card">
        <h2>Drar mest just nu</h2>
        {top.length === 0 && <p className="muted">Inga uttag med energimätning hittades ännu.</p>}
        <ul className="consumers">
          {top.map(({ entity, watts: w }) => (
            <li key={entity.entity_id}>
              <span className="c-name">{nameOf(entity)}</span>
              <span className="c-bar">
                <span style={{ width: `${(w / topMax) * 100}%` }} />
              </span>
              <span className="c-val">{watts(w)}</span>
            </li>
          ))}
        </ul>
      </section>

    </div>
  )
}
