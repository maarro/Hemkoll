import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  callService as haCallService,
  createConnection,
  createLongLivedTokenAuth,
  subscribeEntities,
  type Connection,
} from 'home-assistant-js-websocket'
import type { Hass, HassEntities, PricePoint, Settings, Status } from './types'
import { initialMockEntities, mockPrices, mockService, tick } from './mock'

const Ctx = createContext<Hass | null>(null)

export function useHass() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useHass måste användas inom <HassProvider>')
  return v
}

export function HassProvider({ settings, children }: { settings: Settings; children: ReactNode }) {
  const [status, setStatus] = useState<Status>('connecting')
  const [error, setError] = useState<string>()
  const [entities, setEntities] = useState<HassEntities>({})
  const conn = useRef<Connection | null>(null)

  useEffect(() => {
    let cancelled = false
    let unsub: (() => void) | undefined
    let timer: ReturnType<typeof setInterval> | undefined

    if (settings.demo) {
      setStatus('demo')
      setEntities(initialMockEntities())
      timer = setInterval(() => setEntities((e) => tick(e)), 3000)
      return () => clearInterval(timer)
    }
    if (!settings.url || !settings.token) {
      setStatus('unconfigured')
      return
    }

    setStatus('connecting')
    setError(undefined)
    ;(async () => {
      try {
        const auth = createLongLivedTokenAuth(settings.url.replace(/\/$/, ''), settings.token)
        const c = await createConnection({ auth })
        if (cancelled) return c.close()
        conn.current = c
        unsub = subscribeEntities(c, (ents) => setEntities(ents))
        c.addEventListener('ready', () => setStatus('connected'))
        c.addEventListener('disconnected', () => setStatus('connecting'))
        setStatus('connected')
      } catch (e) {
        if (cancelled) return
        setStatus('error')
        setError(
          e === 2
            ? 'Fel token – skapa en ny långlivad åtkomsttoken i din HA-profil.'
            : 'Kunde inte nå Home Assistant. Kontrollera adressen och att du är på hemnätet.',
        )
      }
    })()

    return () => {
      cancelled = true
      unsub?.()
      conn.current?.close()
      conn.current = null
    }
  }, [settings.demo, settings.url, settings.token])

  const callService = useCallback<Hass['callService']>(
    async (domain, service, data, target) => {
      if (settings.demo) {
        setEntities((e) => mockService(e, domain, service, data, target))
        return
      }
      if (!conn.current) throw new Error('Inte ansluten')
      return haCallService(conn.current, domain, service, data, target)
    },
    [settings.demo],
  )

  /** Dagens elpriser via Tibber-integrationens tjänst tibber.get_prices. */
  const getPrices = useCallback(async (): Promise<PricePoint[]> => {
    if (settings.demo) return mockPrices()
    if (!conn.current) return []
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date(start.getTime() + 24 * 3600_000)
    const res = (await haCallService(
      conn.current,
      'tibber',
      'get_prices',
      { start: start.toISOString(), end: end.toISOString() },
      undefined,
      true,
    )) as { response?: { prices?: Record<string, { start_time: string; price: number }[]> } }
    const homes = Object.values(res?.response?.prices ?? {})
    return (homes[0] ?? []).map((p) => ({ start: p.start_time, price: p.price }))
  }, [settings.demo])

  return (
    <Ctx.Provider value={{ status, error, entities, callService, getPrices, baseUrl: settings.demo ? '' : settings.url.replace(/\/$/, '') }}>{children}</Ctx.Provider>
  )
}
