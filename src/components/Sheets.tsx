import { Delete, Moon, ShieldCheck, ShieldOff, X, House, DoorOpen } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useHass } from '../ha/HassProvider'
import { nameOf } from '../ha/selectors'
import { stateSv } from './Tiles'

/** Gemensamt skal för vyer som glider upp nedifrån. Stängs med Esc, kryss eller tryck utanför. */
export function Sheet({ title, sub, onClose, actions, children }: { title: string; sub?: string; onClose: () => void; actions?: ReactNode; children: ReactNode }) {
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => ev.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  // Läggs direkt i <body> så att glasytor (backdrop-filter) runt omkring inte fångar vyn
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(ev) => ev.stopPropagation()}>
        <div className="sheet-grip" />
        <header className="sheet-head">
          <div>
            <div className="sheet-title">{title}</div>
            {sub && <div className="sheet-sub">{sub}</div>}
          </div>
          <div className="sheet-actions">
            {actions}
            <button className="icon-btn" onClick={onClose} aria-label="Stäng">
              <X size={18} />
            </button>
          </div>
        </header>
        {children}
      </div>
    </div>,
    document.body,
  )
}

/** Larmet: välj läge för att larma på, slå kod för att larma av. */
export function AlarmSheet({ entityId, onClose }: { entityId: string; onClose: () => void }) {
  const { entities, callService } = useHass()
  const e = entities[entityId]
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  if (!e) return null
  const armed = e.state.startsWith('armed') || e.state === 'triggered' || e.state === 'pending' || e.state === 'arming'
  const needsCode = !!e.attributes.code_format
  const armNeedsCode = needsCode && e.attributes.code_arm_required !== false
  const target = { entity_id: entityId }

  const arm = async (svc: string) => {
    if (armNeedsCode && !code) return setErr('Slå koden först')
    await callService('alarm_control_panel', svc, code ? { code } : {}, target)
    onClose()
  }
  const disarm = async () => {
    if (needsCode && !code) return setErr('Slå koden för att larma av')
    try {
      await callService('alarm_control_panel', 'alarm_disarm', code ? { code } : {}, target)
    } catch {
      setErr('Fel kod, försök igen')
    }
    setCode('')
  }
  const key = (k: string) => (setErr(''), setCode((c) => (c + k).slice(0, 8)))

  return (
    <Sheet title={nameOf(e)} sub={stateSv[e.state] ?? e.state} onClose={onClose}>
      <div className={`alarm-state ${armed ? 'armed' : ''} ${e.state === 'triggered' ? 'triggered' : ''}`}>
        {armed ? <ShieldCheck size={40} strokeWidth={1.5} /> : <ShieldOff size={40} strokeWidth={1.5} />}
      </div>
      {(needsCode && (armed || armNeedsCode)) && (
        <>
          <div className="code-dots" aria-live="polite" aria-label={`${code.length} siffror inslagna`}>
            {Array.from({ length: Math.max(4, code.length) }).map((_, i) => (
              <span key={i} className={i < code.length ? 'on' : ''} />
            ))}
          </div>
          <div className="keypad">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
              <button key={k} onClick={() => key(k)}>
                {k}
              </button>
            ))}
            <span />
            <button onClick={() => key('0')}>0</button>
            <button onClick={() => setCode((c) => c.slice(0, -1))} aria-label="Radera">
              <Delete size={20} />
            </button>
          </div>
        </>
      )}
      {err && <p className="error center">{err}</p>}
      {armed ? (
        <button className="btn wide big danger" onClick={disarm}>
          Larma av
        </button>
      ) : (
        <div className="arm-modes">
          <button className="btn big" onClick={() => arm('alarm_arm_away')}>
            <DoorOpen size={18} /> Borta
          </button>
          <button className="btn big" onClick={() => arm('alarm_arm_home')}>
            <House size={18} /> Hemma
          </button>
          <button className="btn big" onClick={() => arm('alarm_arm_night')}>
            <Moon size={18} /> Natt
          </button>
        </div>
      )}
    </Sheet>
  )
}

/** En kamera i stort format. Bilden uppdateras varannan sekund medan vyn är öppen. */
export function CameraSheet({ entityId, onClose }: { entityId: string; onClose: () => void }) {
  const { entities, baseUrl } = useHass()
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 2000)
    return () => clearInterval(t)
  }, [])
  const e = entities[entityId]
  if (!e) return null
  const pic = e.attributes.entity_picture as string | undefined
  const src = !pic ? undefined : pic.startsWith('data:') ? pic : `${baseUrl}${pic}&_=${tick}`
  return (
    <Sheet title={nameOf(e)} sub="Uppdateras varannan sekund" onClose={onClose}>
      <div className="cam-big">{src ? <img src={src} alt={`Bild från ${nameOf(e)}`} /> : <p className="muted">Kameran skickar ingen bild.</p>}</div>
    </Sheet>
  )
}
