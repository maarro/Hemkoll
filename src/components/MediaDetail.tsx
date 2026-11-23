import { useEffect, useState } from 'react'
import { config } from '../config'
import { useHass } from '../ha/HassProvider'
import { groupable, mediaKind, nameOf, remoteFor } from '../ha/selectors'
import type { HassEntity } from '../ha/types'
import { stateSv } from './Tiles'
import { toggleFavorite, useFavorites } from '../ui/favorites'

const CMD = {
  apple: { up: 'up', down: 'down', left: 'left', right: 'right', ok: 'select', back: 'menu', home: 'home', volUp: 'volume_up', volDown: 'volume_down' },
  android: { up: 'DPAD_UP', down: 'DPAD_DOWN', left: 'DPAD_LEFT', right: 'DPAD_RIGHT', ok: 'DPAD_CENTER', back: 'BACK', home: 'HOME', volUp: 'VOLUME_UP', volDown: 'VOLUME_DOWN' },
}

const icon = { speaker: '🔊', tv: '📺', console: '🎮' }

/** Helskärmsvy för att styra en mediaspelare: Sonos, Apple TV, Google TV, PlayStation … */
export function MediaDetail({ entityId, onClose }: { entityId: string; onClose: () => void }) {
  const { entities, callService, baseUrl } = useHass()
  const e = entities[entityId] as HassEntity | undefined
  const [vol, setVol] = useState<number>()
  const fav = useFavorites().includes(entityId)

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => ev.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!e) return null
  const a = e.attributes
  const kind = mediaKind(e)
  const target = { entity_id: entityId }
  const off = e.state === 'off' || e.state === 'standby'
  const mp = (service: string, data: Record<string, unknown> = {}) => callService('media_player', service, data, target)
  const volume = vol ?? (typeof a.volume_level === 'number' ? (a.volume_level as number) : undefined)
  const muted = a.is_volume_muted === true
  const remote = kind === 'tv' ? remoteFor(entities, entityId) : undefined
  const send = (key: keyof typeof CMD.apple) =>
    remote && callService('remote', 'send_command', { command: CMD[remote.type][key] }, { entity_id: remote.remote })
  const sources = (a.source_list as string[] | undefined) ?? []
  const group = (a.group_members as string[] | undefined) ?? []
  const others = groupable(entities, entityId)
  const consolePower = kind === 'console' ? config.consolePower[entityId] : undefined
  const picture = a.entity_picture ? `${baseUrl}${a.entity_picture}` : undefined

  const toggleGroup = (otherId: string) => {
    if (group.includes(otherId)) return callService('media_player', 'unjoin', {}, { entity_id: otherId })
    return mp('join', { group_members: [otherId] })
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={nameOf(e)} onClick={(ev) => ev.stopPropagation()}>
        <div className="sheet-grip" />
        <header className="sheet-head">
          <div>
            <div className="sheet-title">{nameOf(e)}</div>
            <div className="muted small">
              {stateSv[e.state] ?? e.state}
              {a.app_name ? ` · ${a.app_name}` : a.source ? ` · ${a.source}` : ''}
            </div>
          </div>
          <div className="row tight">
            <button
              className={`icon-btn star ${fav ? 'on' : ''}`}
              onClick={() => toggleFavorite(entityId)}
              aria-label={fav ? 'Ta bort från favoriter' : 'Fäst på startsidan'}
              aria-pressed={fav}
            >
              {fav ? '★' : '☆'}
            </button>
            <button className="icon-btn" onClick={onClose} aria-label="Stäng">
              ✕
            </button>
          </div>
        </header>

        {/* Spelas nu */}
        <div className="now">
          <div className="art" style={picture ? { backgroundImage: `url(${picture})` } : undefined}>
            {!picture && <span>{icon[kind]}</span>}
          </div>
          <div className="now-text">
            <div className="now-title ellipsis">{(a.media_title as string) ?? (off ? 'Avstängd' : 'Inget spelas')}</div>
            <div className="muted small ellipsis">{(a.media_artist as string) ?? (a.media_album_name as string) ?? ''}</div>
          </div>
        </div>

        {!off && kind !== 'console' && (
          <div className="transport">
            <button className="round" onClick={() => mp('media_previous_track')} aria-label="Föregående">⏮</button>
            <button className="round big-btn" onClick={() => mp('media_play_pause')} aria-label="Spela/pausa">
              {e.state === 'playing' ? '⏸' : '▶'}
            </button>
            <button className="round" onClick={() => mp('media_next_track')} aria-label="Nästa">⏭</button>
          </div>
        )}

        {!off && volume !== undefined && (
          <div className="volume">
            <button className="icon-btn" onClick={() => mp('volume_mute', { is_volume_muted: !muted })} aria-label={muted ? 'Slå på ljud' : 'Stäng av ljud'}>
              {muted ? '🔇' : '🔈'}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(volume * 100)}
              aria-label="Volym"
              onChange={(ev) => setVol(Number(ev.target.value) / 100)}
              onPointerUp={() => vol !== undefined && mp('volume_set', { volume_level: vol }).then(() => setVol(undefined))}
              onKeyUp={() => vol !== undefined && mp('volume_set', { volume_level: vol }).then(() => setVol(undefined))}
            />
            <span className="vol">{Math.round(volume * 100)}</span>
          </div>
        )}

        {/* Fjärrkontroll för TV */}
        {remote && !off && (
          <section className="sheet-section">
            <h3>Fjärrkontroll</h3>
            <div className="remote">
              <div className="dpad">
                <button className="d up" onClick={() => send('up')} aria-label="Upp">▲</button>
                <button className="d left" onClick={() => send('left')} aria-label="Vänster">◀</button>
                <button className="d ok" onClick={() => send('ok')}>OK</button>
                <button className="d right" onClick={() => send('right')} aria-label="Höger">▶</button>
                <button className="d down" onClick={() => send('down')} aria-label="Ner">▼</button>
              </div>
              <div className="remote-side">
                <button className="btn small" onClick={() => send('back')}>↩ Tillbaka</button>
                <button className="btn small" onClick={() => send('home')}>⌂ Hem</button>
                <div className="row">
                  <button className="btn small wide" onClick={() => send('volDown')} aria-label="Volym ner">🔉</button>
                  <button className="btn small wide" onClick={() => send('volUp')} aria-label="Volym upp">🔊</button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Appar på Google TV */}
        {remote?.type === 'android' && !off && config.tvApps.length > 0 && (
          <section className="sheet-section">
            <h3>Appar</h3>
            <div className="chips">
              {config.tvApps.map((app) => (
                <button key={app.name} className="chip" onClick={() => callService('remote', 'turn_on', { activity: app.activity }, { entity_id: remote.remote })}>
                  {app.name}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Källor: appar på Apple TV, favoriter på Sonos */}
        {sources.length > 0 && !off && (
          <section className="sheet-section">
            <h3>{kind === 'speaker' ? 'Favoriter' : 'Appar & källor'}</h3>
            <div className="chips">
              {sources.map((s) => (
                <button key={s} className={`chip ${a.source === s || a.app_name === s ? 'sel' : ''}`} onClick={() => mp('select_source', { source: s })}>
                  {s}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Sonos-gruppering */}
        {others.length > 0 && !off && (
          <section className="sheet-section">
            <h3>Spela även i</h3>
            {others.map((o) => {
              const on = group.includes(o.entity_id)
              return (
                <button key={o.entity_id} className={`room ${on ? 'on' : ''}`} onClick={() => toggleGroup(o.entity_id)}>
                  <span>{nameOf(o)}</span>
                  <span className="check">{on ? '✓' : '+'}</span>
                </button>
              )
            })}
          </section>
        )}

        {kind === 'console' && !consolePower && (
          <p className="note small">
            PlayStation visar status (vad som spelas, online) via PSN. För att slå på och stänga av konsolen behövs tillägget{' '}
            <strong>PS5-MQTT</strong> i Home Assistant. Lägg sedan in dess switch i <code>config.consolePower</code>.
          </p>
        )}

        <button
          className={`btn wide power ${off ? 'primary' : 'danger'}`}
          onClick={() =>
            consolePower
              ? callService('homeassistant', off ? 'turn_on' : 'turn_off', {}, { entity_id: consolePower })
              : mp(off ? 'turn_on' : 'turn_off')
          }
          disabled={kind === 'console' && !consolePower}
        >
          {off ? 'Slå på' : 'Stäng av'}
        </button>
      </div>
    </div>
  )
}
