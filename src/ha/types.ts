import type { HassEntities, HassEntity } from 'home-assistant-js-websocket'

export type { HassEntities, HassEntity }

export type Status = 'demo' | 'connecting' | 'connected' | 'error' | 'unconfigured'

export interface PricePoint {
  start: string // ISO
  price: number // kr/kWh
}

export interface Area {
  id: string
  name: string
  icon?: string
}

export interface LogEvent {
  when: number // ms
  entity_id: string
  state: string
  name: string
}

export interface Hass {
  /** Rum från Home Assistant (area registry). Tom lista om inga rum finns. */
  areas: Area[]
  /** entity_id -> area_id. Entiteter som är dolda eller diagnostik saknas här och i ui:t. */
  areaOf: Record<string, string>
  /** Entiteter som HA markerat som dolda, inställningar eller diagnostik. */
  noise: Set<string>
  /** Historik för en sensor: [tid ms, värde]. */
  getHistory: (entityId: string, minutes: number) => Promise<[number, number][]>
  /** Dagliga maxvärden från HA:s statistik (t.ex. ackumulerad kostnad per dag). */
  getDaily: (statisticId: string, days: number) => Promise<{ day: number; cost: number }[]>
  /** Logbok (händelser) sedan start, för valda entiteter. */
  getLogbook: (start: Date, entityIds: string[]) => Promise<LogEvent[]>
  status: Status
  /** Adress till HA, för bilder (entity_picture). Tom i demoläge. */
  baseUrl: string
  error?: string
  entities: HassEntities
  callService: (
    domain: string,
    service: string,
    data?: Record<string, unknown>,
    target?: { entity_id: string | string[] },
  ) => Promise<unknown>
  getPrices: () => Promise<PricePoint[]>
}

export interface Settings {
  url: string
  token: string
  demo: boolean
}
