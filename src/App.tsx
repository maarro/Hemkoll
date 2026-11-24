import { Clock3, DoorOpen, House, Settings2, Zap, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { HassProvider, useHass } from './ha/HassProvider'
import { loadSettings, saveSettings } from './ha/settings'
import type { Settings } from './ha/types'
import { Home } from './pages/Home'
import { Rooms } from './pages/Rooms'
import { Energy } from './pages/Energy'
import { Events } from './pages/Events'
import { SettingsPage } from './pages/SettingsPage'
import { MediaDetail } from './components/MediaDetail'
import { AlarmSheet, CameraSheet } from './components/Sheets'
import { Greeting } from './components/Greeting'
import { UiProvider } from './ui/UiContext'

type Tab = 'home' | 'rooms' | 'energy' | 'events' | 'settings'

const TABS: [Tab, LucideIcon, string][] = [
  ['home', House, 'Hem'],
  ['rooms', DoorOpen, 'Rum'],
  ['energy', Zap, 'Energi'],
  ['events', Clock3, 'Händelser'],
  ['settings', Settings2, 'Inställningar'],
]

function Shell({ settings, onSave }: { settings: Settings; onSave: (s: Settings) => void }) {
  const { status } = useHass()
  const [tab, setTab] = useState<Tab>(status === 'unconfigured' ? 'settings' : 'home')
  const go = (t: Tab) => {
    setTab(t)
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="app">
      {tab === 'home' ? (
        <Greeting status={status} />
      ) : (
        <header className="page-head">
          <h1>{TABS.find((t) => t[0] === tab)?.[2]}</h1>
        </header>
      )}
      <main>
        {tab === 'home' && <Home goEnergy={() => go('energy')} />}
        {tab === 'rooms' && <Rooms />}
        {tab === 'energy' && <Energy />}
        {tab === 'events' && <Events />}
        {tab === 'settings' && <SettingsPage settings={settings} onSave={onSave} />}
      </main>
      <nav className="tabs" aria-label="Flikar">
        {TABS.map(([id, Icon, label]) => (
          <button key={id} className={tab === id ? 'sel' : ''} onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined}>
            <Icon size={22} strokeWidth={tab === id ? 2.1 : 1.7} aria-hidden />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const save = (s: Settings) => {
    saveSettings(s)
    setSettings(s)
  }
  return (
    <HassProvider settings={settings}>
      <UiProvider
        renderSheet={(kind, id, close) =>
          kind === 'media' ? (
            <MediaDetail entityId={id} onClose={close} />
          ) : kind === 'alarm' ? (
            <AlarmSheet entityId={id} onClose={close} />
          ) : (
            <CameraSheet entityId={id} onClose={close} />
          )
        }
      >
        <Shell settings={settings} onSave={save} />
      </UiProvider>
    </HassProvider>
  )
}
