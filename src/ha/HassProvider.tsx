import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  callService as haCallService,
  createConnection,
  createLongLivedTokenAuth,
  subscribeEntities,
  type Connection,
} from 'home-assistant-js-websocket'
import type { Area, Hass, HassEntities, LogEvent, PricePoint, Settings, Status } from './types'
import { initialMockEntities, mockAreaOf, mockAreas, mockDailyCost, mockLogbook, mockPowerHistory, mockPrices, mockService, tick } from './mock'

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
  const [areas, setAreas] = useState<Area[]>([])
  const [areaOf, setAreaOf] = useState<Record<string, string>>({})
  const [noise, setNoise] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    let unsub: (() => void) | undefined
    let timer: ReturnType<typeof setInterval> | undefined

    if (settings.demo) {
      setStatus('demo')
      setEntities(initialMockEntities())
      setAreas(mockAreas)
      setAreaOf(mockAreaOf)
      setNoise(new Set())
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
        loadRegistries(c)
          .then((r) => {
            if (cancelled) return
            setAreas(r.areas)
            setAreaOf(r.areaOf)
            setNoise(r.noise)
          })
          .catch(() => {
            /* utan rum fungerar appen ändå – visar allt under Enheter */
          })
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

  /** Händelser från HA:s logbok. */
  const getLogbook = useCallback(
    async (start: Date, entityIds: string[]): Promise<LogEvent[]> => {
      if (settings.demo) return mockLogbook(start)
      if (!conn.current || entityIds.length === 0) return []
      const rows = await conn.current.sendMessagePromise<
        { when: number; entity_id?: string; state?: string; name?: string }[]
      >({ type: 'logbook/get_events', start_time: start.toISOString(), entity_ids: entityIds })
      return rows
        .filter((r) => r.entity_id && r.state)
        .map((r) => ({
          when: r.when * 1000,
          entity_id: r.entity_id as string,
          state: r.state as string,
          name: r.name ?? (r.entity_id as string),
        }))
    },
    [settings.demo],
  )

  const getHistory = useCallback(
    async (entityId: string, minutes: number): Promise<[number, number][]> => {
      if (settings.demo) return mockPowerHistory(minutes)
      if (!conn.current || !entityId) return []
      const res = await conn.current.sendMessagePromise<Record<string, { s: string; lu: number }[]>>({
        type: 'history/history_during_period',
        start_time: new Date(Date.now() - minutes * 60_000).toISOString(),
        entity_ids: [entityId],
        minimal_response: true,
        no_attributes: true,
        significant_changes_only: false,
      })
      return (res[entityId] ?? [])
        .map((r) => [r.lu * 1000, Number(r.s)] as [number, number])
        .filter(([, v]) => Number.isFinite(v))
    },
    [settings.demo],
  )

  /**
   * Kostnad per dag. Tibber lägger in egen statistik (tibber:energy_totalcost_<hem>) som
   * finns även utan Pulse – den används i första hand. Annars dagens maxvärde från en
   * ackumulerande kostnadssensor.
   */
  const getDaily = useCallback(
    async (fallbackId: string, days: number) => {
      if (settings.demo) return mockDailyCost(days)
      const c = conn.current
      if (!c) return []
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      start.setDate(start.getDate() - (days - 1))
      type Row = { start: number | string; max?: number | null; change?: number | null }
      const ids = await c
        .sendMessagePromise<{ statistic_id: string }[]>({ type: 'recorder/list_statistic_ids', statistic_type: 'sum' })
        .catch(() => [])
      const tibberCost = ids.map((i) => i.statistic_id).find((i) => i.startsWith('tibber:energy_totalcost'))
      const id = tibberCost ?? fallbackId
      if (!id) return []
      const res = await c.sendMessagePromise<Record<string, Row[]>>({
        type: 'recorder/statistics_during_period',
        start_time: start.toISOString(),
        statistic_ids: [id],
        period: 'day',
        types: [tibberCost ? 'change' : 'max'],
      })
      return (res[id] ?? [])
        .map((r) => ({ day: typeof r.start === 'number' ? r.start : new Date(r.start).getTime(), cost: (tibberCost ? r.change : r.max) ?? null }))
        .filter((r): r is { day: number; cost: number } => r.cost != null)
    },
    [settings.demo],
  )

  return (
    <Ctx.Provider
      value={{
        status,
        error,
        entities,
        callService,
        getPrices,
        getLogbook,
        getHistory,
        getDaily,
        areas,
        areaOf,
        noise,
        baseUrl: settings.demo ? '' : settings.url.replace(/\/$/, ''),
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

type RegEntity = {
  entity_id?: string
  ei?: string
  area_id?: string | null
  ai?: string | null
  device_id?: string | null
  di?: string | null
  entity_category?: string | null
  ec?: number | null
  hidden_by?: string | null
  hb?: boolean
}

/** Rum och dolda entiteter från HA:s register. Enhetens rum gäller om entiteten saknar eget. */
async function loadRegistries(c: Connection) {
  const [areaList, devices, entityList] = await Promise.all([
    c.sendMessagePromise<{ area_id: string; name: string; icon?: string | null }[]>({ type: 'config/area_registry/list' }),
    c.sendMessagePromise<{ id: string; area_id: string | null }[]>({ type: 'config/device_registry/list' }),
    c.sendMessagePromise<RegEntity[]>({ type: 'config/entity_registry/list' }),
  ])
  const deviceArea = new Map(devices.map((d) => [d.id, d.area_id]))
  const areaOf: Record<string, string> = {}
  const noise = new Set<string>()
  for (const e of entityList) {
    const id = e.entity_id ?? e.ei
    if (!id) continue
    if (e.entity_category || e.ec != null || e.hidden_by || e.hb) noise.add(id)
    const dev = e.device_id ?? e.di
    const area = e.area_id ?? e.ai ?? (dev ? deviceArea.get(dev) : null)
    if (area) areaOf[id] = area
  }
  const areas = areaList.map((a) => ({ id: a.area_id, name: a.name })).sort((a, b) => a.name.localeCompare(b.name, 'sv'))
  return { areas, areaOf, noise }
}
