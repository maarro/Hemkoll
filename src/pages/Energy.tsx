import { config } from '../config'
import { useHass } from '../ha/HassProvider'
import { consumers, nameOf, num, tibber } from '../ha/selectors'
import { PriceChart } from '../components/PriceChart'
import { CostHistory } from '../components/CostHistory'
import { watts } from '../components/Tiles'
import { applianceIcon } from '../ui/icons'

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
      <section className="card energy-hero">
        <div>
          <div className="muted">Huset drar just nu</div>
          <div className="huge">{watts(power)}</div>
          <div className="muted">
            {costPerHour !== undefined
              ? `Det motsvarar ${costPerHour.toLocaleString('sv-SE', { maximumFractionDigits: 2 })} kr i timmen`
              : 'Koppla in Tibber Pulse för att se effekten i realtid'}
          </div>
        </div>
        <dl className="facts">
          <div>
            <dt>Kostnad idag</dt>
            <dd>
              {num(t.cost)?.toLocaleString('sv-SE', { maximumFractionDigits: 1 }) ?? '–'} <span className="unit">kr</span>
            </dd>
          </div>
          <div>
            <dt>Förbrukat idag</dt>
            <dd>
              {num(t.consumption)?.toLocaleString('sv-SE', { maximumFractionDigits: 1 }) ?? '–'} <span className="unit">kWh</span>
            </dd>
          </div>
        </dl>
      </section>

      {appliances.length > 0 && (
        <div className="status-row">
          {appliances.map((a) => {
            const running = entities[a.running]?.state === 'on'
            const Icon = applianceIcon(a.name)
            return (
              <div key={a.power} className={`card status ${running ? 'lit' : ''}`}>
                <Icon size={22} strokeWidth={1.75} aria-hidden />
                <span className="status-name">{a.name}</span>
                <span className="status-value">{running ? `${a.verb}, ${watts(num(entities[a.power]))}` : 'Ledig'}</span>
              </div>
            )
          })}
        </div>
      )}

      <section className="card">
        <h2>Kostnad per dag</h2>
        <CostHistory />
      </section>

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
