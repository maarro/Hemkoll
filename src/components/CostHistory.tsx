import { useEffect, useState } from 'react'
import { useHass } from '../ha/HassProvider'
import { tibber } from '../ha/selectors'

/** Elkostnad per dag senaste veckan, från HA:s statistik för Tibbers kostnadssensor. */
export function CostHistory() {
  const { entities, getDaily, status } = useHass()
  const id = tibber(entities).cost?.entity_id ?? ''
  const [rows, setRows] = useState<{ day: number; cost: number }[] | null>(null)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    if (!id || (status !== 'connected' && status !== 'demo')) return
    let alive = true
    getDaily(id, 7)
      .then((r) => alive && setRows(r))
      .catch(() => alive && setRows([]))
    return () => {
      alive = false
    }
  }, [getDaily, id, status])

  if (!id) return null
  if (!rows) return <p className="muted">Hämtar historik…</p>
  if (!rows.length) return <p className="muted">Ingen historik ännu. Den fylls på dag för dag.</p>

  const max = Math.max(...rows.map((r) => r.cost)) * 1.1
  const week = rows.reduce((a, r) => a + r.cost, 0)
  const shown = hover ?? rows.length - 1
  const label = (t: number) => new Date(t).toLocaleDateString('sv-SE', { weekday: 'short' }).replace('.', '')
  const today = new Date().toDateString()

  return (
    <div className="hist">
      <div className="hist-head">
        <div>
          <div className="muted">{new Date(rows[shown].day).toDateString() === today ? 'Idag hittills' : new Date(rows[shown].day).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'short' })}</div>
          <div className="big">
            {Math.round(rows[shown].cost)} <span className="unit">kr</span>
          </div>
        </div>
        <div className="hist-week">
          <div className="muted">Senaste 7 dagarna</div>
          <div className="mid">{Math.round(week)} kr</div>
        </div>
      </div>
      <div className="hbars" onMouseLeave={() => setHover(null)}>
        {rows.map((r, i) => {
          const isToday = new Date(r.day).toDateString() === today
          return (
            <button
              key={r.day}
              className={`hbar-col ${i === shown ? 'sel' : ''} ${isToday ? 'today' : ''}`}
              onMouseEnter={() => setHover(i)}
              onClick={() => setHover(i)}
              aria-label={`${label(r.day)}: ${Math.round(r.cost)} kronor`}
            >
              <span className="hbar" style={{ height: `${(r.cost / max) * 100}%` }} />
              <span className="hbar-label">{isToday ? 'idag' : label(r.day)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
