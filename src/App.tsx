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
import { UiProvider } from './ui/UiContext'

type Tab = 'home' | 'rooms' | 'energy' | 'events' | 'settings'

const TABS: [Tab, string, string][] = [
  ['home', '🏠', 'Hem'],
  ['rooms', '🚪', 'Rum'],
  ['energy', '⚡', 'Energi'],
  ['events', '🕒', 'Händelser'],
  ['settings', '⚙️', 'Inställningar'],
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
      <header className="top">
        <h1>{tab === 'home' ? 'Hemkoll' : TABS.find((t) => t[0] === tab)?.[2]}</h1>
        <span className={`pill ${status}`}>
          {status === 'demo' ? 'Demo' : status === 'connected' ? 'Live' : status === 'connecting' ? 'Ansluter…' : 'Offline'}
        </span>
      </header>
      <main>
        {tab === 'home' && <Home goEnergy={() => go('energy')} />}
        {tab === 'rooms' && <Rooms />}
        {tab === 'energy' && <Energy />}
        {tab === 'events' && <Events />}
        {tab === 'settings' && <SettingsPage settings={settings} onSave={onSave} />}
      </main>
      <nav className="tabs">
        {TABS.map(([id, icon, label]) => (
          <button key={id} className={tab === id ? 'sel' : ''} onClick={() => go(id)}>
            <span aria-hidden>{icon}</span>
            {label}
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
      <UiProvider renderMedia={(id, close) => <MediaDetail entityId={id} onClose={close} />}>
        <Shell settings={settings} onSave={save} />
      </UiProvider>
    </HassProvider>
  )
}
