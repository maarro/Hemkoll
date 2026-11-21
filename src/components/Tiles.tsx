import { useHass } from '../ha/HassProvider'
import { mediaKind, nameOf, num, powerFor } from '../ha/selectors'
import { config } from '../config'
import type { HassEntity } from '../ha/types'

export const watts = (w?: number) =>
  w === undefined ? '–' : w >= 1000 ? `${(w / 1000).toLocaleString('sv-SE', { maximumFractionDigits: 2 })}\u00a0kW` : `${Math.round(w)}\u00a0W`

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button className={`toggle ${on ? 'on' : ''}`} onClick={onClick} aria-pressed={on} aria-label={label}>
      <span />
    </button>
  )
}

export function PlugTile({ entity }: { entity: HassEntity }) {
  const { entities, callService } = useHass()
  const on = entity.state === 'on'
  const power = powerFor(entities, entity.entity_id)
  const unavailable = entity.state === 'unavailable'
  return (
    <div className={`tile ${on ? 'active' : ''} ${unavailable ? 'dim' : ''}`}>
      <div className="tile-main">
        <div className="tile-name">{nameOf(entity)}</div>
        <div className="muted small">
          {unavailable ? 'Ej tillgänglig' : on ? 'På' : 'Av'}
          {power && on ? ` · ${watts(num(power))}` : ''}
        </div>
      </div>
      <Toggle
        on={on}
        label={`Slå ${on ? 'av' : 'på'} ${nameOf(entity)}`}
        onClick={() => callService('homeassistant', on ? 'turn_off' : 'turn_on', {}, { entity_id: entity.entity_id })}
      />
    </div>
  )
}

export function ComputerTile({ entity }: { entity: HassEntity }) {
  const { callService } = useHass()
  const on = entity.state === 'on'
  return (
    <div className={`tile ${on ? 'active' : ''}`}>
      <div className="tile-main">
        <div className="tile-name">💻 {nameOf(entity)}</div>
        <div className="muted small">{on ? 'Igång' : 'Avstängd / sover'}</div>
      </div>
      <button
        className="btn small"
        onClick={() => callService('homeassistant', on ? 'turn_off' : 'turn_on', {}, { entity_id: entity.entity_id })}
      >
        {on ? 'Stäng av' : 'Väck'}
      </button>
    </div>
  )
}

export const stateSv: Record<string, string> = {
  playing: 'Spelar',
  paused: 'Pausad',
  idle: 'Redo',
  on: 'På',
  off: 'Av',
  standby: 'Viloläge',
  unavailable: 'Ej tillgänglig',
}

export function MediaTile({ entity, onOpen }: { entity: HassEntity; onOpen?: () => void }) {
  const { callService } = useHass()
  const a = entity.attributes
  const off = entity.state === 'off' || entity.state === 'standby'
  const title = [a.media_title, a.media_artist].filter(Boolean).join(' – ')
  const isConsole = mediaKind(entity) === 'console'
  const canPower = !isConsole || !!config.consolePower[entity.entity_id]
  const target = { entity_id: entity.entity_id }

  return (
    <div
      className={`tile media clickable ${entity.state === 'playing' ? 'active' : ''}`}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(ev) => ev.key === 'Enter' && onOpen?.()}
    >
      <div className="tile-main">
        <div className="tile-name">{nameOf(entity)}</div>
        <div className="muted small ellipsis">
          {stateSv[entity.state] ?? entity.state}
          {a.app_name ? ` · ${a.app_name}` : ''}
          {title ? ` · ${title}` : ''}
        </div>
      </div>
      <div className="controls" onClick={(ev) => ev.stopPropagation()}>
        {!off && !isConsole && (
          <button className="icon-btn" onClick={() => callService('media_player', 'media_play_pause', {}, target)} aria-label="Spela/pausa">
            {entity.state === 'playing' ? '⏸' : '▶'}
          </button>
        )}
        {canPower && (
          <button
            className="icon-btn"
            onClick={() =>
              isConsole
                ? callService('homeassistant', off ? 'turn_on' : 'turn_off', {}, { entity_id: config.consolePower[entity.entity_id] })
                : callService('media_player', off ? 'turn_on' : 'turn_off', {}, target)
            }
            aria-label={off ? 'Slå på' : 'Stäng av'}
          >
            ⏻
          </button>
        )}
        <span className="chev" aria-hidden>›</span>
      </div>
    </div>
  )
}
