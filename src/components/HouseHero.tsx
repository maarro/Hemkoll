import { useEffect, useState } from 'react'
import { useHass } from '../ha/HassProvider'
import { domainOf, persons, weather } from '../ha/selectors'
import type { HassEntity } from '../ha/types'

const isOn = (e: HassEntity) =>
  (['light', 'switch', 'fan'].includes(domainOf(e.entity_id)) && e.state === 'on') ||
  (domainOf(e.entity_id) === 'media_player' && ['playing', 'paused', 'on'].includes(e.state))

// Fönstren på husets långsida (x och y vid väggens vänstra kant, bredd, höjd) och gaveln.
// Långsidan lutar uppåt åt höger, så fönstren följer samma lutning.
const SLOPE = -16 / 90
const SIDE = [
  { x: 184, y: 140, w: 20, h: 16 },
  { x: 224, y: 140, w: 20, h: 16 },
  { x: 184, y: 117, w: 20, h: 13 },
  { x: 224, y: 117, w: 20, h: 13 },
]
const FRONT = [
  { x: 122, y: 128, w: 18, h: 20 },
  { x: 132, y: 98, w: 14, h: 13 },
]

/** Parallellogram för ett fönster på långsidan, som följer väggens lutning. */
function sideWindow({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const dy = (x - 170) * SLOPE
  const dw = w * SLOPE
  return `M${x},${y + dy} L${x + w},${y + dy + dw} L${x + w},${y + dy + dw + h} L${x},${y + dy + h} Z`
}
/** Fönster på gaveln, som lutar svagt nedåt åt höger. */
function frontWindow({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const s = 10 / 60
  const dy = (x - 110) * s
  return `M${x},${y + dy} L${x + w},${y + dy + w * s} L${x + w},${y + dy + w * s + h} L${x},${y + dy + h} Z`
}

/**
 * Huset överst på Hem. Fönstren lyser i de rum där något är på, skorstenen ryker när
 * någon är hemma, och det ligger snö på taket när det är minusgrader eller snöar.
 * Natt med måne och stjärnor, dag med sol.
 */
export function HouseHero() {
  const { entities, areas, areaOf } = useHass()
  const [hour, setHour] = useState(new Date().getHours())
  useEffect(() => {
    const t = setInterval(() => setHour(new Date().getHours()), 5 * 60_000)
    return () => clearInterval(t)
  }, [])

  const night = hour >= 16 || hour < 8
  const w = weather(entities)
  const temp = typeof w?.attributes.temperature === 'number' ? (w.attributes.temperature as number) : undefined
  const snow = /snow/.test(w?.state ?? '') || (temp !== undefined && temp <= 0)
  const home = persons(entities).some((p) => p.state === 'home')

  // Vilka rum har något påslaget? Ett fönster per rum, i rumsordning.
  const on = Object.values(entities).filter(isOn)
  const litAreas = new Set(on.map((e) => areaOf[e.entity_id]).filter(Boolean))
  const windows = [...FRONT.map((f) => ({ d: frontWindow(f), cx: f.x + f.w / 2, cy: f.y + 8 })), ...SIDE.map((s) => ({ d: sideWindow(s), cx: s.x + s.w / 2, cy: s.y + (s.x - 170) * SLOPE + 6 }))]
  const lit = windows.map((_, i) => {
    if (areas.length) {
      const a = areas[i % areas.length]
      return i < areas.length ? litAreas.has(a.id) : false
    }
    return i < Math.min(windows.length, on.length)
  })
  const anyLit = lit.some(Boolean)

  const wall = night ? { front: '#6f7f9e', side: '#4f5d7a', roofA: '#2b3246', roofB: '#1f2536', trim: '#8d9bb8' } : { front: '#b9c4d8', side: '#8d9ab3', roofA: '#3d465f', roofB: '#2f364b', trim: '#e8edf5' }
  const glass = night ? '#232a3b' : '#5d6e8c'

  return (
    <div className={`house-hero ${night ? 'night' : 'day'}`} aria-hidden>
      <svg viewBox="0 0 360 200" role="presentation">
        <defs>
          <radialGradient id="hh-glow">
            <stop offset="0" stopColor="#ffc864" stopOpacity="0.75" />
            <stop offset="1" stopColor="#ffc864" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="hh-sun">
            <stop offset="0" stopColor="#ffd36b" stopOpacity="0.45" />
            <stop offset="1" stopColor="#ffd36b" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="hh-ground" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={snow ? (night ? '#46506a' : '#eef2f8') : night ? '#1d2a2a' : '#5f7d5a'} />
            <stop offset="1" stopColor={snow ? (night ? '#1a1d2a' : '#9aa6ba') : '#11151c'} stopOpacity="0" />
          </linearGradient>
        </defs>


        {/* Himlen */}
        {night ? (
          <g className="hh-stars">
            <circle cx="292" cy="34" r="13" fill="#f3f0e2" />
            <circle cx="298" cy="30" r="12" fill="#2a3150" opacity="0.92" />
            {[
              [40, 30], [72, 52], [100, 22], [250, 60], [320, 76], [212, 26], [24, 70], [336, 40],
            ].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={i % 3 ? 1 : 1.5} fill="#fff" className={`hh-star s${i % 3}`} />
            ))}
          </g>
        ) : (
          <g>
            <circle cx="296" cy="38" r="40" fill="url(#hh-sun)" />
            <circle cx="296" cy="38" r="14" fill="#ffd36b" />
          </g>
        )}

        {/* Marken */}
        <path d="M0,200 L0,168 Q180,128 360,168 L360,200 Z" fill="url(#hh-ground)" />

        {/* Ljus som faller ut på marken */}
        {night && anyLit && <ellipse cx="190" cy="172" rx="80" ry="12" fill="url(#hh-glow)" opacity="0.5" />}

        {/* Träd */}
        {[
          [62, 168, 1],
          [86, 172, 0.75],
          [300, 162, 0.9],
          [322, 168, 0.65],
        ].map(([x, y, s], i) => (
          <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
            <rect x="-2" y="-6" width="4" height="8" fill={night ? '#2a2620' : '#6b5440'} />
            <path d="M0,-58 L16,-22 L8,-22 L20,-6 L-20,-6 L-8,-22 L-16,-22 Z" fill={night ? '#22352f' : '#3f6b4f'} />
            {snow && <path d="M0,-58 L8,-40 L0,-44 L-8,-40 Z" fill="#f4f7fb" opacity={night ? 0.7 : 0.95} />}
          </g>
        ))}

        {/* Skugga under huset */}
        <ellipse cx="188" cy="168" rx="92" ry="9" fill="#000" opacity="0.28" />

        {/* Långsidan */}
        <path d="M170,170 L260,154 L260,96 L170,112 Z" fill={wall.side} />
        {/* Gaveln */}
        <path d="M110,160 L170,170 L170,112 L140,80 L110,102 Z" fill={wall.front} />
        {/* Sockel */}
        <path d="M110,160 L170,170 L260,154 L260,158 L170,174 L110,164 Z" fill={night ? '#3a4256' : '#8e98aa'} />

        {/* Taket */}
        <path d="M140,76 L174,114 L264,98 L232,60 Z" fill={wall.roofA} />
        <path d="M140,76 L106,104 L110,106 L140,82 L170,114 L174,114 Z" fill={wall.roofB} />
        {snow && (
          <>
            <path d="M140,76 L156,94 L246,78 L232,60 Z" fill="#f4f7fb" opacity={night ? 0.75 : 0.95} />
            <path d="M140,76 L122,91 L140,82 Z" fill="#f4f7fb" opacity={night ? 0.6 : 0.9} />
          </>
        )}

        {/* Skorsten och rök */}
        <path d="M212,70 L224,68 L224,50 L212,52 Z" fill={night ? '#5a4a48' : '#9b6f5e'} />
        <path d="M224,68 L230,72 L230,54 L224,50 Z" fill={night ? '#463a39' : '#7c5749'} />
        {home && (
          <g className="hh-smoke" fill={night ? '#9aa3b8' : '#ffffff'}>
            <circle cx="219" cy="42" r="4" />
            <circle cx="223" cy="32" r="5" />
            <circle cx="219" cy="20" r="6" />
          </g>
        )}

        {/* Dörr på gaveln */}
        <path d="M148,146 L160,148 L160,170 L148,168 Z" fill={night ? '#2e3548' : '#5b6a86'} />
        <circle cx="157.5" cy="159" r="0.9" fill="#ffd36b" />

        {/* Fönster: sken bakom de tända, sedan rutorna */}
        {windows.map((win, i) =>
          lit[i] && night ? <circle key={`g${i}`} cx={win.cx} cy={win.cy} r="22" fill="url(#hh-glow)" className="hh-glow" /> : null,
        )}
        {windows.map((win, i) => (
          <path key={i} d={win.d} fill={lit[i] ? '#ffd27a' : glass} stroke={wall.trim} strokeWidth="1.4" strokeLinejoin="round" className={lit[i] ? 'hh-lit' : ''} />
        ))}
      </svg>
    </div>
  )
}
