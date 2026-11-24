import { Pause, Play, Star } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useHass } from '../ha/HassProvider'
import { computers, domainOf, mediaKind, nameOf, num, powerFor } from '../ha/selectors'
import type { HassEntity } from '../ha/types'
import { toggleFavorite, useFavorites } from '../ui/favorites'
import { iconFor } from '../ui/icons'
import { useUi } from '../ui/UiContext'
import { useLongPress } from '../ui/useLongPress'
import { stateSv, watts } from './Tiles'

/** Domäner som går att styra och därför visas i rum och favoriter. */
export const CONTROLLABLE = ['switch', 'light', 'fan', 'media_player', 'lock', 'alarm_control_panel']

const LIT = new Set(['on', 'playing', 'paused', 'idle', 'unlocked', 'armed_away', 'armed_home', 'armed_night'])

/**
 * En ruta per enhet. Tryck = det naturliga för enheten (tända/släcka, öppna kontrollvyn,
 * låsa). Det som går att ångra direkt sker direkt; det som inte går (låsa upp, stänga av
 * en dator) kräver ett andra tryck. Håll inne = fäst som favorit.
 */
export function EntityTile({ entity }: { entity: HassEntity }) {
  const { entities, callService } = useHass()
  const { openMedia, openAlarm, toast } = useUi()
  const fav = useFavorites().includes(entity.entity_id)
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])

  const press = useLongPress(() => {
    toggleFavorite(entity.entity_id)
    toast(fav ? `${nameOf(entity)} borttagen från Hem` : `${nameOf(entity)} fäst på Hem`)
  })

  const d = domainOf(entity.entity_id)
  const isComputer = computers(entities).some((c) => c.entity_id === entity.entity_id)
  const Icon = iconFor(entity, isComputer)
  const s = entity.state
  const target = { entity_id: entity.entity_id }
  const unavailable = s === 'unavailable'
  const a = entity.attributes

  let lit = LIT.has(s) && !(d === 'media_player' && s === 'idle')
  let status = stateSv[s] ?? s
  let detail = ''
  let wide = false
  let warn = false
  let onTap: (() => void) | undefined

  if (d === 'media_player') {
    lit = s === 'playing'
    wide = s === 'playing' || s === 'paused'
    detail = [a.media_title, a.media_artist ?? a.app_name].filter(Boolean).join(', ')
    if (mediaKind(entity) === 'console' && s === 'on') (status = 'Igång'), (lit = true)
    onTap = () => openMedia(entity.entity_id)
  } else if (d === 'lock') {
    warn = s === 'unlocked'
    lit = false
    if (armed) status = 'Tryck igen för att låsa upp'
    onTap = () => {
      if (s !== 'locked') return callService('lock', 'lock', {}, target)
      if (!armed) return setArmed(true)
      setArmed(false)
      callService('lock', 'unlock', {}, target)
    }
  } else if (d === 'alarm_control_panel') {
    warn = s === 'triggered'
    onTap = () => openAlarm(entity.entity_id)
  } else if (isComputer) {
    status = s === 'on' ? (armed ? 'Tryck igen för att stänga av' : 'Igång') : 'Sover'
    onTap = () => {
      if (s !== 'on') return callService('homeassistant', 'turn_on', {}, target)
      if (!armed) return setArmed(true)
      setArmed(false)
      callService('homeassistant', 'turn_off', {}, target)
    }
  } else {
    const p = num(powerFor(entities, entity.entity_id))
    if (s === 'on' && p !== undefined) detail = watts(p)
    if (d === 'fan' && s === 'on' && typeof a.percentage === 'number') detail = `${a.percentage} %`
    onTap = () => callService('homeassistant', s === 'on' ? 'turn_off' : 'turn_on', {}, target)
  }

  return (
    <div
      className={`tile ${lit ? 'lit' : ''} ${warn ? 'warn' : ''} ${armed ? 'armed' : ''} ${wide ? 'wide' : ''} ${unavailable ? 'gone' : ''}`}
      role="button"
      tabIndex={0}
      aria-pressed={d === 'media_player' ? undefined : lit}
      aria-label={`${nameOf(entity)}, ${status}`}
      onClick={unavailable ? undefined : onTap}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onTap?.())}
      {...press}
    >
      <div className="tile-top">
        <span className="tile-icon">
          <Icon size={20} strokeWidth={1.75} />
        </span>
        {fav && <Star className="tile-star" size={12} fill="currentColor" aria-label="Favorit" />}
        {d === 'media_player' && wide && (
          <button
            className="tile-play"
            aria-label={s === 'playing' ? 'Pausa' : 'Spela'}
            onClick={(e) => {
              e.stopPropagation()
              callService('media_player', 'media_play_pause', {}, target)
            }}
          >
            {s === 'playing' ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
          </button>
        )}
      </div>
      <div className="tile-name">{nameOf(entity)}</div>
      <div className="tile-state">
        {status}
        {detail && <span className="tile-detail">{detail}</span>}
      </div>
    </div>
  )
}

/** Rutnät av rutor. */
export function TileGrid({ list }: { list: HassEntity[] }) {
  return (
    <div className="tiles">
      {list.map((e) => (
        <EntityTile key={e.entity_id} entity={e} />
      ))}
    </div>
  )
}
