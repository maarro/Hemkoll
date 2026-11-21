import { useState } from 'react'
import { HassProvider, useHass } from './ha/HassProvider'
import { loadSettings, saveSettings } from './ha/settings'
import type { Settings } from './ha/types'
import { Overview } from './pages/Overview'
import { Devices } from './pages/Devices'
import { SettingsPage } from './pages/SettingsPage'

type Tab = 'overview' | 'devices' | 'settings'

function Shell({ settings, onSave }: { settings: Settings; onSave: (s: Settings) => void }) {
  const { status } = useHass()
  const [tab, setTab] = useState<Tab>(status === 'unconfigured' ? 'settings' : 'overview')

  return (
    <div className="app">
      <header className="top">
        <h1>Hemkoll</h1>
        <span className={`pill ${status}`}>
          {status === 'demo' ? 'Demo' : status === 'connected' ? 'Live' : status === 'connecting' ? 'Ansluter…' : 'Offline'}
        </span>
      </header>
      <main>
        {tab === 'overview' && <Overview />}
        {tab === 'devices' && <Devices />}
        {tab === 'settings' && <SettingsPage settings={settings} onSave={onSave} />}
      </main>
      <nav className="tabs">
        {(
          [
            ['overview', '⚡', 'Översikt'],
            ['devices', '🏠', 'Enheter'],
            ['settings', '⚙️', 'Inställningar'],
          ] as const
        ).map(([id, icon, label]) => (
          <button key={id} className={tab === id ? 'sel' : ''} onClick={() => setTab(id)}>
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
      <Shell settings={settings} onSave={save} />
    </HassProvider>
  )
}
