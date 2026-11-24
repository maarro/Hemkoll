import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Moon, Sun, Wind } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useHass } from '../ha/HassProvider'
import { nameOf, persons, weather } from '../ha/selectors'

const COND: Record<string, [string, typeof Sun]> = {
  sunny: ['Soligt', Sun],
  'clear-night': ['Klart', Moon],
  partlycloudy: ['Halvklart', CloudSun],
  cloudy: ['Mulet', Cloud],
  rainy: ['Regn', CloudRain],
  pouring: ['Skyfall', CloudRain],
  snowy: ['Snö', CloudSnow],
  'snowy-rainy': ['Snöblandat regn', CloudSnow],
  fog: ['Dimma', CloudFog],
  windy: ['Blåsigt', Wind],
  lightning: ['Åska', CloudLightning],
  'lightning-rainy': ['Åska och regn', CloudLightning],
}

function greeting(h: number) {
  if (h < 5) return 'God natt'
  if (h < 10) return 'God morgon'
  if (h < 17) return 'Hej'
  if (h < 23) return 'God kväll'
  return 'God natt'
}

/** Överst på Hem: hälsning, datum, väder och vem som är hemma. */
export function Greeting({ status }: { status: string }) {
  const { entities } = useHass()
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])
  const w = weather(entities)
  const cond = w ? COND[w.state] : undefined
  const temp = typeof w?.attributes.temperature === 'number' ? Math.round(w.attributes.temperature as number) : undefined
  const people = persons(entities)
  const WIcon = cond?.[1]
  const date = now.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <header className="greet">
      <div>
        <h1>{greeting(now.getHours())}</h1>
        <p className="greet-sub">
          <span className="greet-date">{date}</span>
          {w && temp !== undefined && (
            <span className="greet-weather">
              {WIcon && <WIcon size={15} strokeWidth={1.75} aria-hidden />}
              {temp}° {cond?.[0]?.toLowerCase()}
            </span>
          )}
        </p>
      </div>
      <div className="greet-right">
        {status !== 'connected' && <span className={`pill ${status}`}>{status === 'demo' ? 'Demo' : status === 'connecting' ? 'Ansluter' : 'Offline'}</span>}
        <div className="people">
          {people.map((p) => (
            <span key={p.entity_id} className={`avatar ${p.state === 'home' ? 'home' : 'away'}`} title={`${nameOf(p)}: ${p.state === 'home' ? 'hemma' : 'borta'}`}>
              {nameOf(p).slice(0, 1)}
            </span>
          ))}
        </div>
      </div>
    </header>
  )
}
