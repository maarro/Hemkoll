import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useHass } from '../ha/HassProvider'
import { sceneButtons } from '../ha/scenes'
import { useUi } from '../ui/UiContext'

/** Scenknapparna: ett tryck och allt som hör till scenen händer. Scenerna skapas i Home Assistant. */
export function Scenes() {
  const { entities, callService, status, noise, baseUrl } = useHass()
  const { toast } = useUi()
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const demo = status === 'demo'
  const scenes = sceneButtons(entities, callService, demo, noise)
  const editor = baseUrl ? `${baseUrl}/config/scene/dashboard` : undefined

  if (!scenes.length) {
    if (status !== 'connected') return null
    return (
      <a className="card scenes-empty" href={editor} target="_blank" rel="noreferrer">
        <Plus size={22} strokeWidth={1.75} aria-hidden />
        <span>
          <strong>Skapa din första scen</strong>
          <span className="muted small">Till exempel God natt: släck, lås och stäng av TV:n. Görs i Home Assistant och dyker sedan upp här.</span>
        </span>
      </a>
    )
  }

  return (
    <div className="scenes">
      {scenes.map((s) => {
        const Icon = s.icon
        return (
          <button
            key={s.id}
            className={`scene ${busy === s.id ? 'busy' : ''} ${done === s.id ? 'done' : ''}`}
            disabled={busy !== null}
            onClick={async () => {
              setBusy(s.id)
              try {
                const n = await s.run()
                toast(n === 0 ? `${s.name}: inget behövde ändras` : `${s.name} klar`)
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
