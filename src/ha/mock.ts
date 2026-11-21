// Demoläge: låtsas-Home Assistant med dina prylar, så att appen går att
// utveckla och visa innan hårdvaran är på plats.
import type { HassEntities, HassEntity, PricePoint } from './types'

const now = () => new Date().toISOString()

function ent(entity_id: string, state: string, attributes: Record<string, unknown> = {}): HassEntity {
  const t = now()
  return {
    entity_id,
    state,
    attributes,
    last_changed: t,
    last_updated: t,
    context: { id: entity_id, parent_id: null, user_id: null },
  }
}

const W = { unit_of_measurement: 'W', device_class: 'power', state_class: 'measurement' }

export function initialMockEntities(): HassEntities {
  const list: HassEntity[] = [
    // Tibber + Pulse
    ent('sensor.power_hemma', '1840', { ...W, friendly_name: 'Effekt hemma' }),
    ent('sensor.electricity_price_hemma', String(currentMockPrice()), {
      unit_of_measurement: 'SEK/kWh',
      friendly_name: 'Elpris',
    }),
    ent('sensor.accumulated_cost_hemma', '18.4', { unit_of_measurement: 'SEK', friendly_name: 'Kostnad idag' }),
    ent('sensor.accumulated_consumption_hemma', '14.2', {
      unit_of_measurement: 'kWh',
      friendly_name: 'Förbrukning idag',
    }),

    // Tvättmaskin på Shelly Plug PM
    ent('sensor.tvattmaskin_power', '1980', { ...W, friendly_name: 'Tvättmaskin' }),
    ent('input_boolean.tvatt_pagar', 'on', { friendly_name: 'Tvätt pågår' }),
    ent('sensor.torktumlare_power', '1', { ...W, friendly_name: 'Torktumlare' }),
    ent('input_boolean.tork_pagar', 'off', { friendly_name: 'Tork pågår' }),

    // Uttag
    ent('switch.tv_bank', 'on', { friendly_name: 'TV-bänk' }),
    ent('sensor.tv_bank_power', '96', { ...W, friendly_name: 'TV-bänk' }),
    ent('switch.deltaco_vardagsrum', 'on', { friendly_name: 'Golvlampa vardagsrum (Deltaco)' }),
    ent('sensor.deltaco_vardagsrum_power', '9', { ...W, friendly_name: 'Golvlampa vardagsrum' }),
    ent('switch.ikea_hall', 'off', { friendly_name: 'Hallampa (IKEA)' }),
    ent('switch.kaffebryggare', 'off', { friendly_name: 'Kaffebryggare' }),
    ent('sensor.kaffebryggare_power', '0', { ...W, friendly_name: 'Kaffebryggare' }),

    // Media
    ent('media_player.sonos_vardagsrum', 'playing', {
      friendly_name: 'Sonos Vardagsrum',
      media_title: 'Morgonpasset',
      media_artist: 'Sveriges Radio P3',
      volume_level: 0.22,
      is_volume_muted: false,
      source_list: ['P3', 'P4 Stockholm', 'Spotify: Dagens mix', 'Spotify: Fokus', 'Rix FM'],
      source: 'P3',
      group_members: ['media_player.sonos_vardagsrum'],
    }),
    ent('media_player.sonos_kok', 'idle', {
      friendly_name: 'Sonos Kök',
      volume_level: 0.3,
      is_volume_muted: false,
      source_list: ['P3', 'P4 Stockholm', 'Spotify: Dagens mix', 'Spotify: Fokus', 'Rix FM'],
      group_members: ['media_player.sonos_kok'],
    }),
    ent('media_player.sonos_sovrum', 'idle', {
      friendly_name: 'Sonos Sovrum',
      volume_level: 0.15,
      is_volume_muted: false,
      source_list: ['P3', 'P4 Stockholm', 'Spotify: Dagens mix', 'Spotify: Fokus', 'Rix FM'],
      group_members: ['media_player.sonos_sovrum'],
    }),
    ent('media_player.apple_tv', 'paused', {
      friendly_name: 'Apple TV',
      app_name: 'SVT Play',
      media_title: 'Melodifestivalen',
      volume_level: 0.4,
      source_list: ['SVT Play', 'Netflix', 'YouTube', 'Disney+', 'Spotify', 'TV4 Play'],
    }),
    ent('remote.apple_tv', 'on', { friendly_name: 'Apple TV' }),
    ent('media_player.google_tv', 'playing', {
      friendly_name: 'Google TV',
      app_name: 'YouTube',
      media_title: 'Innebandy – SSL highlights',
      volume_level: 0.35,
      is_volume_muted: false,
    }),
    ent('remote.google_tv', 'on', { friendly_name: 'Google TV' }),
    ent('media_player.google_home_kok', 'idle', { friendly_name: 'Google Home Kök', volume_level: 0.4 }),
    ent('media_player.playstation_5', 'on', { friendly_name: 'PlayStation 5', media_title: 'EA Sports FC 26', app_name: 'Spelar' }),

    // Datorer (Wake-on-LAN)
    ent('switch.dator_kontor', 'on', { friendly_name: 'Dator kontor' }),
    ent('switch.mac_marcus', 'off', { friendly_name: 'Mac Marcus' }),
  ]
  return Object.fromEntries(list.map((e) => [e.entity_id, e]))
}

/** Typisk svensk vinterdag: dyrt morgon och kväll, billigt natt. Kvartspriser. */
function priceAt(d: Date) {
  const h = d.getHours() + d.getMinutes() / 60
  const morning = Math.exp(-((h - 8) ** 2) / 3) * 1.4
  const evening = Math.exp(-((h - 18) ** 2) / 4) * 1.8
  const base = 0.45 + 0.15 * Math.sin(h / 3)
  return Math.round((base + morning + evening) * 100) / 100
}

export function currentMockPrice() {
  return priceAt(new Date())
}

export function mockPrices(): PricePoint[] {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const out: PricePoint[] = []
  for (let i = 0; i < 96; i++) {
    const d = new Date(start.getTime() + i * 15 * 60_000)
    out.push({ start: d.toISOString(), price: priceAt(d) })
  }
  return out
}

/** Små slumpmässiga ändringar så att demot känns levande. */
export function tick(entities: HassEntities): HassEntities {
  const next = { ...entities }
  const jitter = (id: string, base: number, spread: number) => {
    if (!next[id]) return
    const v = Math.max(0, Math.round(base + (Math.random() - 0.5) * spread))
    next[id] = { ...next[id], state: String(v), last_updated: now() }
  }
  const sw = (id: string) => next[id]?.state === 'on'
  const washing = next['input_boolean.tvatt_pagar']?.state === 'on'
  jitter('sensor.tvattmaskin_power', washing ? 1900 : 1, washing ? 300 : 1)
  const drying = next['input_boolean.tork_pagar']?.state === 'on'
  jitter('sensor.torktumlare_power', drying ? 750 : 1, drying ? 120 : 1)
  jitter('sensor.tv_bank_power', sw('switch.tv_bank') ? 95 : 0, sw('switch.tv_bank') ? 10 : 0)
  jitter('sensor.deltaco_vardagsrum_power', sw('switch.deltaco_vardagsrum') ? 9 : 0, 1)
  jitter('sensor.kaffebryggare_power', sw('switch.kaffebryggare') ? 1100 : 0, sw('switch.kaffebryggare') ? 40 : 0)
  const parts = ['sensor.tvattmaskin_power', 'sensor.torktumlare_power','sensor.tv_bank_power', 'sensor.deltaco_vardagsrum_power', 'sensor.kaffebryggare_power']
    .map((id) => Number(next[id]?.state ?? 0))
    .reduce((a, b) => a + b, 0)
  jitter('sensor.power_hemma', 650 + parts, 80)
  next['sensor.electricity_price_hemma'] = {
    ...next['sensor.electricity_price_hemma'],
    state: String(currentMockPrice()),
  }
  return next
}

/** Fejkad tjänsteanrop: slå av/på och styr media. */
export function mockService(
  entities: HassEntities,
  domain: string,
  service: string,
  data: Record<string, unknown> = {},
  target?: { entity_id: string | string[] },
): HassEntities {
  const ids = ([] as string[]).concat(target?.entity_id ?? (data.entity_id as string) ?? [])
  const next = { ...entities }
  for (const id of ids) {
    const e = next[id]
    if (!e) continue
    let state = e.state
    const attributes = { ...e.attributes }
    if (service === 'turn_on') state = e.entity_id.startsWith('media_player') ? 'idle' : 'on'
    if (service === 'turn_off') state = 'off'
    if (service === 'toggle') state = e.state === 'off' ? 'on' : 'off'
    if (service === 'media_play_pause') state = e.state === 'playing' ? 'paused' : 'playing'
    if (service === 'volume_set') attributes.volume_level = data.volume_level
    if (service === 'volume_mute') attributes.is_volume_muted = data.is_volume_muted
    if (service === 'select_source') {
      attributes.source = data.source
      if (id.includes('tv')) attributes.app_name = data.source
      attributes.media_title = String(data.source)
      attributes.media_artist = undefined
      state = 'playing'
    }
    if (service === 'media_next_track' || service === 'media_previous_track') {
      const songs = ['Nästa låt', 'Ett annat spår', 'Morgonpasset']
      attributes.media_title = songs[Math.floor(Math.random() * songs.length)]
    }
    if (service === 'join') {
      const members = new Set([id, ...((data.group_members as string[]) ?? [])])
      for (const m of members) if (next[m]) next[m] = { ...next[m], attributes: { ...next[m].attributes, group_members: [...members] } }
      Object.assign(attributes, { group_members: [...members] })
    }
    if (service === 'unjoin') {
      for (const other of Object.values(next)) {
        const gm = other.attributes.group_members as string[] | undefined
        if (gm?.includes(id) && other.entity_id !== id)
          next[other.entity_id] = { ...other, attributes: { ...other.attributes, group_members: gm.filter((x) => x !== id) } }
      }
      attributes.group_members = [id]
    }
    if (domain === 'remote' && service === 'turn_on' && data.activity) {
      const tv = next[id.replace('remote.', 'media_player.')]
      if (tv) next[tv.entity_id] = { ...tv, state: 'playing', attributes: { ...tv.attributes, app_name: String(data.activity).replace(/^https?:\/\/(www\.)?/, '').replace('com.netflix.ninja', 'Netflix') } }
    }
    if (domain === 'remote') continue // fjärrkontrollen själv ändrar inte läge
    next[id] = { ...next[id], ...{ state, attributes: { ...next[id].attributes, ...attributes } }, last_changed: now(), last_updated: now() }
  }
  return next
}
