import { useState } from 'react'
import { useHass } from '../ha/HassProvider'
import type { Settings } from '../ha/types'

export function SettingsPage({ settings, onSave }: { settings: Settings; onSave: (s: Settings) => void }) {
  const { status, error, entities } = useHass()
  const [url, setUrl] = useState(settings.url || 'http://homeassistant.local:8123')
  const [token, setToken] = useState(settings.token)

  return (
    <div className="stack">
      <section className="card">
        <h2>Home Assistant</h2>
        <p className="muted small">
          Status:{' '}
          <strong>
            {
              {
                demo: 'Demoläge (låtsasdata)',
                connecting: 'Ansluter…',
                connected: `Ansluten · ${Object.keys(entities).length} entiteter`,
                error: 'Fel',
                unconfigured: 'Inte inställd',
              }[status]
            }
          </strong>
        </p>
        {error && <p className="error small">{error}</p>}
        <label className="field">
          <span>Adress</span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://homeassistant.local:8123" />
        </label>
        <label className="field">
          <span>Långlivad åtkomsttoken</span>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Profil → Säkerhet → Långlivade åtkomsttoken"
          />
        </label>
        <div className="row">
          <button className="btn primary wide" onClick={() => onSave({ url: url.trim(), token: token.trim(), demo: false })}>
            Anslut
          </button>
          <button className="btn wide" onClick={() => onSave({ ...settings, demo: true })}>
            Demoläge
          </button>
        </div>
        <p className="muted small">Token sparas bara i den här webbläsaren.</p>
      </section>
    </div>
  )
}
