import { config } from '../config'
import { useHass } from '../ha/HassProvider'
import { num, tibber } from '../ha/selectors'
import { PriceChart } from '../components/PriceChart'
import { CostHistory } from '../components/CostHistory'
import { watts } from '../components/Tiles'
import { applianceIcon } from '../ui/icons'
import { LaundryPlanner, Standby, monthForecast } from '../components/EnergyPlus'
import { Meters } from '../components/Meters'
import { MonthInsight, SavingTip, UsageHeatmap, useTibberStats } from '../components/TibberPlus'

/** Energi: effekt, kostnad, elpris och vad som drar mest. */
export function Energy() {
  const { entities } = useHass()
  const t = tibber(entities)
  const ts = useTibberStats()
  const power = num(t.power)
  const price = num(t.price)
  const costPerHour = power !== undefined && price !== undefined ? (power / 1000) * price : undefined

  const appliances = config.appliances.filter((a) => entities[a.power])
  const forecast = monthForecast(num(t.monthCost))
  const monthName = new Date().toLocaleDateString('sv-SE', { month: 'long' })


  return (
    <div className="stack">
      <section className="card energy-hero">
        <div>
          <div className="muted">{power !== undefined ? 'Huset drar just nu' : 'Elpriset just nu'}</div>
          <div className="huge">{power !== undefined ? watts(power) : price !== undefined ? `${price.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr/kWh` : '–'}</div>
          <div className="muted">
            {costPerHour !== undefined
              ? `Det motsvarar ${costPerHour.toLocaleString('sv-SE', { maximumFractionDigits: 2 })} kr i timmen`
              : 'Effekten i realtid kommer när Pulse sitter i elmätaren'}
          </div>
        </div>
        <dl className="facts">
          {num(t.cost) !== undefined && (
            <div>
              <dt>Kostnad idag</dt>
              <dd>
                {num(t.cost)?.toLocaleString('sv-SE', { maximumFractionDigits: 1 })} <span className="unit">kr</span>
              </dd>
            </div>
          )}
          {num(t.consumption) !== undefined && (
            <div>
              <dt>Förbrukat idag</dt>
              <dd>
                {num(t.consumption)?.toLocaleString('sv-SE', { maximumFractionDigits: 1 })} <span className="unit">kWh</span>
              </dd>
            </div>
          )}
          {num(t.monthCost) !== undefined && (
            <div>
              <dt>Kostnad i månaden</dt>
              <dd>
                {Math.round(num(t.monthCost) as number).toLocaleString('sv-SE')} <span className="unit">kr</span>
              </dd>
            </div>
          )}
          {forecast !== undefined && (
            <div>
              <dt>Prognos för {monthName}</dt>
              <dd>
                {(Math.round(forecast / 10) * 10).toLocaleString('sv-SE')} <span className="unit">kr</span>
              </dd>
            </div>
          )}
          {num(t.monthConsumption) !== undefined && (
            <div>
              <dt>Förbrukat i månaden</dt>
              <dd>
                {Math.round(num(t.monthConsumption) as number).toLocaleString('sv-SE')} <span className="unit">kWh</span>
              </dd>
            </div>
          )}
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

      {ts && <MonthInsight s={ts} />}
      {ts && <SavingTip s={ts} />}

      <LaundryPlanner />

      <section className="card">
        <h2>Kostnad per dag</h2>
        <CostHistory />
      </section>

      <section className="card">
        <h2>Elpris</h2>
        <PriceChart />
      </section>

      {ts && <UsageHeatmap s={ts} />}

      <Standby />

      <Meters />

    </div>
  )
}
