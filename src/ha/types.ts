import type { HassEntities, HassEntity } from 'home-assistant-js-websocket'

export type { HassEntities, HassEntity }

export type Status = 'demo' | 'connecting' | 'connected' | 'error' | 'unconfigured'

export interface PricePoint {
  start: string // ISO
  price: number // kr/kWh
}

export interface Hass {
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
