import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Gamepad2,
  House,
  Pause,
  Play,
  Power,
  SkipBack,
  SkipForward,
  Speaker,
  Star,
  Tv,
  Undo2,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useState } from 'react'
import { config } from '../config'
import { useHass } from '../ha/HassProvider'
import { groupable, mediaKind, nameOf, remoteFor } from '../ha/selectors'
import type { HassEntity } from '../ha/types'
import { toggleFavorite, useFavorites } from '../ui/favorites'
import { Sheet } from './Sheets'
import { stateSv } from './Tiles'

const CMD = {
  apple: { up: 'up', down: 'down', left: 'left', right: 'right', ok: 'select', back: 'menu', home: 'home', volUp: 'volume_up', volDown: 'volume_down' },
  android: { up: 'DPAD_UP', down: 'DPAD_DOWN', left: 'DPAD_LEFT', right: 'DPAD_RIGHT', ok: 'DPAD_CENTER', back: 'BACK', home: 'HOME', volUp: 'VOLUME_UP', volDown: 'VOLUME_DOWN' },
}

const KindIcon = { speaker: Speaker, tv: Tv, console: Gamepad2 }

/** Kontrollvyn för en mediaspelare: Sonos, Apple TV, Google TV, Google Home, PlayStation. */
export function MediaDetail({ entityId, onClose }: { entityId: string; onClose: () => void }) {
  const { entities, callService, baseUrl } = useHass()
  const e = entities[entityId] as HassEntity | undefined
  const [vol, setVol] = useState<number>()
  const fav = useFavorites().includes(entityId)

  if (!e) return null
  const a = e.attributes
  const kind = mediaKind(e)
  const Icon = KindIcon[kind]
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
  const pic = a.entity_picture as string | undefined
  const picture = pic ? (pic.startsWith('data:') || pic.startsWith('http') ? pic : `${baseUrl}${pic}`) : undefined
  const sub = [stateSv[e.state] ?? e.state, a.app_name ?? a.source].filter(Boolean).join(', ')
  const commitVol = () => vol !== undefined && mp('volume_set', { volume_level: vol }).then(() => setVol(undefined))

  const toggleGroup = (otherId: string) => {
    if (group.includes(otherId)) return callService('media_player', 'unjoin', {}, { entity_id: otherId })
    return mp('join', { group_members: [otherId] })
  }

  return (
    <Sheet
      title={nameOf(e)}
      sub={sub}
      onClose={onClose}
      actions={
        <button
          className={`icon-btn star ${fav ? 'on' : ''}`}
          onClick={() => toggleFavorite(entityId)}
          aria-label={fav ? 'Ta bort från Hem' : 'Fäst på Hem'}
          aria-pressed={fav}
        >
          <Star size={18} fill={fav ? 'currentColor' : 'none'} />
        </button>
      }
    >
      <div className="now">
        <div className={`art ${e.state === 'playing' ? 'lit' : ''}`} style={picture ? { backgroundImage: `url(${picture})` } : undefined}>
          {!picture && <Icon size={30} strokeWidth={1.5} />}
        </div>
        <div className="now-text">
          <div className="now-title">{(a.media_title as string) ?? (off ? 'Avstängd' : 'Inget spelas')}</div>
          <div className="now-artist">{(a.media_artist as string) ?? (a.media_album_name as string) ?? ''}</div>
        </div>
      </div>

      {!off && kind !== 'console' && (
        <div className="transport">
          <button className="round" onClick={() => mp('media_previous_track')} aria-label="Föregående">
            <SkipBack size={20} fill="currentColor" />
          </button>
          <button className="round main" onClick={() => mp('media_play_pause')} aria-label={e.state === 'playing' ? 'Pausa' : 'Spela'}>
            {e.state === 'playing' ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" />}
          </button>
          <button className="round" onClick={() => mp('media_next_track')} aria-label="Nästa">
            <SkipForward size={20} fill="currentColor" />
          </button>
        </div>
      )}

      {!off && volume !== undefined && (
        <div className="volume">
          <button className="icon-btn" onClick={() => mp('volume_mute', { is_volume_muted: !muted })} aria-label={muted ? 'Slå på ljudet' : 'Stäng av ljudet'}>
            {muted ? <VolumeX size={18} /> : <Volume1 size={18} />}
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(volume * 100)}
            aria-label="Volym"
            style={{ ['--v' as string]: `${Math.round(volume * 100)}%` }}
            onChange={(ev) => setVol(Number(ev.target.value) / 100)}
            onPointerUp={commitVol}
            onKeyUp={commitVol}
          />
          <span className="vol">{Math.round(volume * 100)}</span>
        </div>
      )}

      {remote && !off && (
        <section className="sheet-section">
          <h3>Fjärrkontroll</h3>
          <div className="remote">
            <div className="dpad">
              <button className="d up" onClick={() => send('up')} aria-label="Upp">
                <ChevronUp size={22} />
              </button>
              <button className="d left" onClick={() => send('left')} aria-label="Vänster">
                <ChevronLeft size={22} />
              </button>
              <button className="d ok" onClick={() => send('ok')}>
                OK
              </button>
              <button className="d right" onClick={() => send('right')} aria-label="Höger">
                <ChevronRight size={22} />
              </button>
              <button className="d down" onClick={() => send('down')} aria-label="Ner">
                <ChevronDown size={22} />
              </button>
            </div>
            <div className="remote-side">
              <button className="btn" onClick={() => send('back')}>
                <Undo2 size={16} /> Tillbaka
              </button>
              <button className="btn" onClick={() => send('home')}>
                <House size={16} /> Hem
              </button>
              <div className="row">
                <button className="btn wide" onClick={() => send('volDown')} aria-label="Sänk volymen">
                  <Volume1 size={18} />
                </button>
                <button className="btn wide" onClick={() => send('volUp')} aria-label="Höj volymen">
                  <Volume2 size={18} />
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {remote?.type === 'android' && !off && config.tvApps.length > 0 && (
        <section className="sheet-section">
          <h3>Starta app</h3>
          <div className="chips">
            {config.tvApps.map((app) => (
              <button key={app.name} className="chip" onClick={() => callService('remote', 'turn_on', { activity: app.activity }, { entity_id: remote.remote })}>
                {app.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {sources.length > 0 && !off && (
        <section className="sheet-section">
          <h3>{kind === 'speaker' ? 'Favoriter' : 'Appar'}</h3>
          <div className="chips">
            {sources.map((s) => (
              <button key={s} className={`chip ${a.source === s || a.app_name === s ? 'sel' : ''}`} onClick={() => mp('select_source', { source: s })}>
                {s}
              </button>
            ))}
          </div>
        </section>
      )}

      {others.length > 0 && !off && (
        <section className="sheet-section">
          <h3>Spela även i</h3>
          <div className="rooms-pick">
            {others.map((o) => {
              const on = group.includes(o.entity_id)
              return (
                <button key={o.entity_id} className={`pick ${on ? 'on' : ''}`} onClick={() => toggleGroup(o.entity_id)} aria-pressed={on}>
                  {nameOf(o).replace(/^Sonos\s*/i, '')}
                </button>
              )
            })}
          </div>
        </section>
      )}

      {kind === 'console' && !consolePower && (
        <p className="note">
          PlayStation visar vad som spelas. För att slå på och stänga av konsolen behövs appen PS5-MQTT i Home Assistant, och dess
          strömbrytare i <code>config.consolePower</code>.
        </p>
      )}

      <button
        className={`btn wide big ${off ? 'primary' : ''}`}
        onClick={() =>
          consolePower
            ? callService('homeassistant', off ? 'turn_on' : 'turn_off', {}, { entity_id: consolePower })
            : mp(off ? 'turn_on' : 'turn_off')
        }
        disabled={kind === 'console' && !consolePower}
      >
        <Power size={18} /> {off ? 'Slå på' : 'Stäng av'}
      </button>
    </Sheet>
  )
}
