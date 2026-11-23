import { useState } from 'react'
import { config } from '../config'
import { useHass } from '../ha/HassProvider'
import { runScene } from '../ha/scenes'
import { useUi } from '../ui/UiContext'

/** Fyra stora knappar: ett tryck och allt som hör till scenen händer. */
export function Scenes() {
  const { entities, callService } = useHass()
  const { toast } = useUi()
  const [busy, setBusy] = useState<string | null>(null)

  return (
    <div className="scenes">
      {config.scenes.map((s) => (
        <button
          key={s.id}
          className={`scene ${busy === s.id ? 'busy' : ''}`}
          disabled={busy !== null}
          onClick={async () => {
            setBusy(s.id)
            try {
              const n = await runScene(s, entities, callService)
              toast(n ? `${s.icon} ${s.name} – klart` : `${s.name}: inget att göra`)
            } catch {
              toast(`${s.name} misslyckades – är Home Assistant nåbar?`)
            } finally {
              setBusy(null)
            }
          }}
        >
          <span className="scene-icon" aria-hidden>
            {s.icon}
          </span>
          <span>{s.name}</span>
        </button>
      ))}
    </div>
  )
}
