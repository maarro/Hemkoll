import { Droplets, Printer, Wifi, WifiOff, ShieldAlert, ShieldCheck, ShieldOff, Thermometer, Wind } from 'lucide-react'
import { useEffect, useState } from 'react'
import { config } from '../config'
import { useHass } from '../ha/HassProvider'
import { alarmPanel, bambu, bathroom, cameras, nameOf, network, num } from '../ha/selectors'
import { kr, priceStats, usePrices } from '../ha/usePrices'
import { useUi } from '../ui/UiContext'
import { applianceIcon } from '../ui/icons'
import { stateSv, watts } from './Tiles'

/** Larmets läge. Tryck för att larma på eller av. */
export function AlarmCard() {
  const { entities } = useHass()
  const { openAlarm } = useUi()
  const a = alarmPanel(entities)
  if (!a) return null
  const armed = a.state.startsWith('armed')
  const Icon = a.state === 'triggered' ? ShieldAlert : armed ? ShieldCheck : ShieldOff
  return (
    <button className={`card status ${a.state === 'triggered' ? 'warn' : armed ? 'secure' : ''}`} onClick={() => openAlarm(a.entity_id)}>
      <Icon size={22} strokeWidth={1.75} aria-hidden />
      <span className="status-name">Larm</span>
      <span className="status-value">{stateSv[a.state] ?? a.state}</span>
    </button>
  )
}

/** Vitvaror som går just nu. */
export function ApplianceCards() {
  const { entities } = useHass()
  return (
    <>
      {config.appliances
        .filter((a) => entities[a.power] && entities[a.running]?.state === 'on')
        .map((a) => (
          <div key={a.power} className="card status lit">
            {(() => {
              const Icon = applianceIcon(a.name)
              return <Icon size={22} strokeWidth={1.75} aria-hidden />
            })()}
            <span className="status-name">{a.name}</span>
            <span className="status-value">
              {a.verb}, {watts(num(entities[a.power]))}
            </span>
          </div>
        ))}
    </>
  )
}

/** Internet via Google Wifi: syns bara när integrationen finns. */
export function NetworkCard() {
  const { entities } = useHass()
  const n = network(entities)
  if (!n) return null
  const down = !n.online && !n.unknown
  const days = n.uptimeDays
  const since =
    days === undefined ? '' : days < 1 ? `i ${Math.max(1, Math.round(days * 24))} tim` : `i ${Math.floor(days)} ${Math.floor(days) === 1 ? 'dag' : 'dagar'}`
  return (
    <div className={`card status ${down ? 'warn' : n.online ? 'secure' : ''}`}>
      {down ? <WifiOff size={22} strokeWidth={1.75} aria-hidden /> : <Wifi size={22} strokeWidth={1.75} aria-hidden />}
      <span className="status-name">Internet</span>
      <span className="status-value">{down ? 'Nere' : n.unknown ? 'Får inget svar från routern' : `Uppe ${since}`}</span>
    </div>
  )
}

/** Badrummet: luftfuktighet och vädring med ett tryck. */
export function BathroomCard() {
  const { entities, callService } = useHass()
  const b = bathroom(entities)
  if (!b) return null
  const airing = b.airing?.state === 'on'
  const humid = (b.humidity ?? 0) >= 65
  const air = () => {
    if (!b.airing) return
    const d = b.airing.entity_id.split('.')[0]
    if (d === 'button') callService('button', 'press', {}, { entity_id: b.airing.entity_id })
    else callService('homeassistant', airing ? 'turn_off' : 'turn_on', {}, { entity_id: b.airing.entity_id })
  }
  return (
    <div className={`card status ${airing ? 'lit' : ''}`}>
      <Droplets size={22} strokeWidth={1.75} aria-hidden />
      <span className="status-name">Badrum</span>
      <span className="status-value">
        {b.humidity !== undefined ? `${Math.round(b.humidity)} % fukt` : '–'}
        {b.temperature !== undefined && <span className="muted">, {b.temperature.toLocaleString('sv-SE', { maximumFractionDigits: 1 })}°</span>}
      </span>
      {b.airing && (
        <button className={`chip-btn ${airing ? 'on' : humid ? 'suggest' : ''}`} onClick={air}>
          <Wind size={14} aria-hidden /> {airing ? 'Vädrar' : 'Vädra'}
        </button>
      )}
    </div>
  )
}

/** Bambu Lab-utskrift: hur långt den kommit, när den är klar och vad den kostar. */
export function BambuCard() {
  const { entities, baseUrl } = useHass()
  const { openCamera } = useUi()
  const { prices } = usePrices()
  const b = bambu(entities)
  if (!b) return null
  const running = ['running', 'printing', 'prepare', 'pause'].includes(b.status ?? '')
  if (!running) return null
  const pct = b.progress ?? 0
  const done = b.remaining !== undefined ? new Date(Date.now() + b.remaining * 60_000) : undefined
  const st = priceStats(prices)
  const perHour = b.power !== undefined && st?.now !== undefined ? (b.power / 1000) * st.now : undefined
  const R = 26
  const C = 2 * Math.PI * R
  const pic = b.camera?.attributes.entity_picture as string | undefined

  return (
    <div className="card bambu">
      <div className="bambu-ring" aria-label={`${Math.round(pct)} procent klart`}>
        <svg viewBox="0 0 64 64" aria-hidden>
          <circle cx="32" cy="32" r={R} className="ring-bg" />
          <circle cx="32" cy="32" r={R} className="ring-fg" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} />
        </svg>
        <span>{Math.round(pct)}%</span>
      </div>
      <div className="bambu-text">
        <div className="bambu-title">
          <Printer size={15} strokeWidth={1.75} aria-hidden /> {b.status === 'pause' ? 'Utskrift pausad' : 'Skriver ut'}
        </div>
        <div className="bambu-task">{b.task ?? 'Okänd fil'}</div>
        <div className="bambu-meta">
          {done && <span>Klar ca {done.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}</span>}
          {b.nozzle !== undefined && (
            <span>
              <Thermometer size={12} aria-hidden /> {Math.round(b.nozzle)}° / {Math.round(b.bed ?? 0)}°
            </span>
          )}
          {perHour !== undefined && <span>{kr(perHour)} kr/h</span>}
        </div>
      </div>
      {pic && b.camera && (
        <button className="bambu-cam" onClick={() => openCamera(b.camera!.entity_id)} aria-label="Visa skrivarkameran">
          <img src={pic.startsWith('data:') ? pic : `${baseUrl}${pic}`} alt="" />
        </button>
      )}
    </div>
  )
}

/** Kamerorna som små bilder som uppdateras var tionde sekund. */
export function CameraStrip() {
  const { entities, baseUrl } = useHass()
  const { openCamera } = useUi()
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 10_000)
    return () => clearInterval(t)
  }, [])
  const list = cameras(entities)
  if (!list.length) return null
  return (
    <section>
      <h2 className="section-title">Kameror</h2>
      <div className="cams">
        {list.map((c) => {
          const pic = c.attributes.entity_picture as string | undefined
          const src = !pic ? undefined : pic.startsWith('data:') ? pic : `${baseUrl}${pic}&_=${tick}`
          return (
            <button key={c.entity_id} className="cam" onClick={() => openCamera(c.entity_id)}>
              {src ? <img src={src} alt={`Bild från ${nameOf(c)}`} /> : <span className="cam-empty">Ingen bild</span>}
              <span className="cam-name">{nameOf(c)}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
