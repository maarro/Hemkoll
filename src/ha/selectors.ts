// Hittar rätt entiteter automatiskt, med config.ts som överstyrning.
import { config } from '../config'
import type { HassEntities, HassEntity } from './types'

export const objectId = (id: string) => id.split('.')[1] ?? id
export const domainOf = (id: string) => id.split('.')[0]
export const nameOf = (e?: HassEntity) => (e?.attributes.friendly_name as string) ?? e?.entity_id ?? ''
export const num = (e?: HassEntity) => {
  const v = Number(e?.state)
  return Number.isFinite(v) ? v : undefined
}

const visible = (id: string) => !config.hidden.includes(id)

function findFirst(ents: HassEntities, override: string, test: (e: HassEntity) => boolean) {
  if (override) return ents[override]
  return Object.values(ents).find(test)
}

export function tibber(ents: HassEntities) {
  return {
    power: findFirst(ents, config.mainPower, (e) => e.entity_id.startsWith('sensor.power_') && e.attributes.unit_of_measurement === 'W'),
    price: findFirst(ents, config.price, (e) => e.entity_id.startsWith('sensor.electricity_price_')),
    cost: findFirst(ents, config.costToday, (e) => e.entity_id.startsWith('sensor.accumulated_cost')),
    consumption: findFirst(ents, config.consumptionToday, (e) => e.entity_id.startsWith('sensor.accumulated_consumption')),
  }
}

/** Effektsensorn som hör till ett uttag (sensor.<namn>_power osv). */
export function powerFor(ents: HassEntities, switchId: string): HassEntity | undefined {
  if (config.powerFor[switchId]) return ents[config.powerFor[switchId]]
  const oid = objectId(switchId)
  for (const suffix of ['_power', '_effekt', '_current_consumption', '_active_power']) {
    const e = ents[`sensor.${oid}${suffix}`]
    if (e) return e
  }
  return undefined
}

const looksLikeComputer = (e: HassEntity) => /dator|\bpc\b|mac|laptop|desktop/i.test(nameOf(e) + ' ' + e.entity_id)

export function computers(ents: HassEntities) {
  if (config.computers.length) return config.computers.map((id) => ents[id]).filter(Boolean)
  return Object.values(ents).filter((e) => domainOf(e.entity_id) === 'switch' && looksLikeComputer(e) && visible(e.entity_id))
}

export function plugs(ents: HassEntities) {
  const comp = new Set(computers(ents).map((e) => e.entity_id))
  return Object.values(ents)
    .filter((e) => domainOf(e.entity_id) === 'switch' && !comp.has(e.entity_id) && visible(e.entity_id))
    .sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'sv'))
}

export function mediaPlayers(ents: HassEntities) {
  return Object.values(ents)
    .filter((e) => domainOf(e.entity_id) === 'media_player' && visible(e.entity_id))
    .sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'sv'))
}

/** Alla effektsensorer utom huvudmätaren, störst först. */
export function consumers(ents: HassEntities) {
  const main = tibber(ents).power?.entity_id
  return Object.values(ents)
    .filter(
      (e) =>
        e.entity_id !== main &&
        domainOf(e.entity_id) === 'sensor' &&
        e.attributes.device_class === 'power' &&
        e.attributes.unit_of_measurement === 'W' &&
        visible(e.entity_id),
    )
    .map((e) => ({ entity: e, watts: num(e) ?? 0 }))
    .sort((a, b) => b.watts - a.watts)
}

export function leaveHomeTargets(ents: HassEntities) {
  if (config.leaveHomeOff.length) return config.leaveHomeOff
  return [...plugs(ents), ...mediaPlayers(ents)].filter((e) => e.state !== 'off').map((e) => e.entity_id)
}

export type MediaKind = 'speaker' | 'tv' | 'console'

export function mediaKind(e: HassEntity): MediaKind {
  if (config.mediaKind[e.entity_id]) return config.mediaKind[e.entity_id]
  const t = (nameOf(e) + ' ' + e.entity_id).toLowerCase()
  if (/playstation|ps5|ps4|xbox|switch_console/.test(t)) return 'console'
  if (/sonos|google home|google_home|nest|högtalare|hogtalare|speaker/.test(t)) return 'speaker'
  return 'tv'
}

/** Fjärrkontrollen som hör till en TV (remote.<samma namn>). */
export function remoteFor(ents: HassEntities, mediaId: string) {
  const c = config.remotes[mediaId]
  if (c) return ents[c.remote] ? c : undefined
  const id = `remote.${objectId(mediaId)}`
  const r = ents[id]
  if (!r) return undefined
  const type: 'apple' | 'android' = /apple/i.test(nameOf(r) + id) ? 'apple' : 'android'
  return { remote: id, type }
}

/** Andra högtalare som kan grupperas med denna (Sonos har group_members). */
export function groupable(ents: HassEntities, mediaId: string) {
  const me = ents[mediaId]
  if (!me || !Array.isArray(me.attributes.group_members)) return []
  return mediaPlayers(ents).filter((e) => e.entity_id !== mediaId && Array.isArray(e.attributes.group_members))
}
