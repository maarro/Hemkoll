import { Lightbulb, Lock, LockOpen, Music, Shield, ShieldCheck, Thermometer, Zap, type LucideIcon } from 'lucide-react'
import { useHass } from '../ha/HassProvider'
import { alarmPanel, domainOf, mediaPlayers, num } from '../ha/selectors'
import { kr, priceStats, usePrices } from '../ha/usePrices'
import { useUi } from '../ui/UiContext'

interface Chip {
  id: string
  icon: LucideIcon
  tone: string
  label: string
  value: string
  onTap?: () => void
}

/** Översikten högst upp, som i Apples Hem-app: klimat, ljus, säkerhet, media och el. */
export function StatusChips({ goEnergy }: { goEnergy: () => void }) {
  const { entities, areaOf } = useHass()
  const { prices } = usePrices()
  const { openAlarm, openMedia } = useUi()
  const ents = Object.values(entities)
  const chips: Chip[] = []

  // Klimat: snitt av temperaturgivare som ligger i ett rum (alltså inomhus)
  const temps = ents
    .filter((e) => domainOf(e.entity_id) === 'sensor' && e.attributes.device_class === 'temperature' && areaOf[e.entity_id])
    .map((e) => num(e))
    .filter((v): v is number => v !== undefined)
  if (temps.length) {
    const lo = Math.min(...temps)
    const hi = Math.max(...temps)
    const f = (v: number) => v.toLocaleString('sv-SE', { maximumFractionDigits: 0 })
    chips.push({ id: 'klimat', icon: Thermometer, tone: 'teal', label: 'Klimat', value: lo === hi || hi - lo < 1 ? `${f(lo)}°` : `${f(lo)}–${f(hi)}°` })
  }

  // Ljus
  const lights = ents.filter((e) => domainOf(e.entity_id) === 'light')
  if (lights.length) {
    const on = lights.filter((e) => e.state === 'on').length
    chips.push({ id: 'ljus', icon: Lightbulb, tone: 'yellow', label: 'Ljus', value: on ? `${on} tända` : 'Alla släckta' })
  }

  // Säkerhet: larm först, annars lås
  const alarm = alarmPanel(entities)
  const locks = ents.filter((e) => domainOf(e.entity_id) === 'lock')
  const open = locks.filter((e) => e.state === 'unlocked').length
  if (alarm || locks.length) {
    const armed = alarm && alarm.state.startsWith('armed')
    const value = open ? `${open} olåst` : armed ? 'Larmat' : locks.length ? 'Låst' : 'Avlarmat'
    chips.push({
      id: 'sak',
      icon: open ? LockOpen : armed ? ShieldCheck : locks.length ? Lock : Shield,
      tone: open ? 'red' : 'green',
      label: 'Säkerhet',
      value,
      onTap: alarm ? () => openAlarm(alarm.entity_id) : undefined,
    })
  }

  // Media
  const playing = mediaPlayers(entities).filter((e) => e.state === 'playing')
  if (playing.length)
    chips.push({
      id: 'media',
      icon: Music,
      tone: 'pink',
      label: 'Spelar',
      value: playing.length === 1 ? String(playing[0].attributes.friendly_name ?? '') : `${playing.length} rum`,
      onTap: () => openMedia(playing[0].entity_id),
    })

  // El
  const st = priceStats(prices)
  if (st?.now !== undefined) chips.push({ id: 'el', icon: Zap, tone: 'orange', label: 'Elpris', value: `${kr(st.now)} kr`, onTap: goEnergy })

  if (!chips.length) return null
  return (
    <div className="chips-row" role="list">
      {chips.map((c) => {
        const Icon = c.icon
        const body = (
          <>
            <span className={`chip-icon ${c.tone}`}>
              <Icon size={16} strokeWidth={2.2} aria-hidden />
            </span>
            <span className="chip-text">
              <span className="chip-label">{c.label}</span>
              <span className="chip-value">{c.value}</span>
            </span>
          </>
        )
        return c.onTap ? (
          <button key={c.id} className="status-chip" role="listitem" onClick={c.onTap}>
            {body}
          </button>
        ) : (
          <div key={c.id} className="status-chip" role="listitem">
            {body}
          </div>
        )
      })}
    </div>
  )
}
