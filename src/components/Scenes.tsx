import { useState } from 'react'
import { config } from '../config'
import { useHass } from '../ha/HassProvider'
import { runScene } from '../ha/scenes'
import { sceneIcon } from '../ui/icons'
import { useUi } from '../ui/UiContext'

/** Fyra knappar: ett tryck och allt som hör till scenen händer. */
export function Scenes() {
  const { entities, callService } = useHass()
  const { toast } = useUi()
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  return (
    <div className="scenes">
      {config.scenes.map((s) => {
        const Icon = sceneIcon(s.id)
        return (
          <button
            key={s.id}
            className={`scene scene-${s.id} ${busy === s.id ? 'busy' : ''} ${done === s.id ? 'done' : ''}`}
            disabled={busy !== null}
            onClick={async () => {
              setBusy(s.id)
              try {
                const n = await runScene(s, entities, callService)
                toast(n ? `${s.name} klar` : `${s.name}: inget behövde ändras`)
                setDone(s.id)
                setTimeout(() => setDone(null), 1600)
              } catch {
                toast(`${s.name} gick inte att köra. Kontrollera att Home Assistant är igång.`)
              } finally {
                setBusy(null)
              }
            }}
          >
            <Icon size={22} strokeWidth={1.75} aria-hidden />
            <span>{s.name}</span>
          </button>
        )
      })}
    </div>
  )
}
