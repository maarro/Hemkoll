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

/**
 * Tibbers sensorer. Namnen blir engelska eller svenska beroende på HA:s språk,
 * så både entity_id och visningsnamn matchas (t.ex. "electricity_price" / "Elpris").
 */
export function tibber(ents: HassEntities) {
  const sensors = Object.values(ents).filter((e) => domainOf(e.entity_id) === 'sensor')
  const match = (re: RegExp, test?: (e: HassEntity) => boolean) =>
    sensors.find((e) => (re.test(e.entity_id) || re.test(nameOf(e))) && (!test || test(e)))
  const unit = (e: HassEntity) => String(e.attributes.unit_of_measurement ?? '')
  return {
    power: findFirst(ents, config.mainPower, (e) =>
      domainOf(e.entity_id) === 'sensor' &&
      unit(e) === 'W' &&
      /^sensor\.(power|effekt)(_|$)|tibber|pulse|^effekt$/i.test(e.entity_id + ' ' + nameOf(e)) &&
      !/_power$|uttag|plug/i.test(e.entity_id),
    ),
    price: config.price ? ents[config.price] : match(/electricity_price|elpris/i, (e) => /\/kWh$/i.test(unit(e))),
    cost: config.costToday ? ents[config.costToday] : match(/accumulated_cost|ackumulerad[_ ]kostnad/i),
    consumption: config.consumptionToday ? ents[config.consumptionToday] : match(/accumulated_consumption|ackumulerad[_ ]förbrukning|ackumulerad_forbrukning/i),
    monthCost: match(/monthly_cost|månadskostnad|manadskostnad/i),
    peak: match(/peak_hour(?!_time)|monthly_peak|topptimme|toppeffekt|max_hour_consumption|maxtimme/i, (e) => !/time|tid/i.test(e.entity_id)),
    peakTime: match(/time_of_max|peak_hour_time|tid.*(max|topp)|tidpunkt/i),
    monthConsumption: match(/monthly_net_consumption|månatlig[_ ]nettoförbrukning|manatlig_nettoforbrukning/i),
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


export type MediaKind = 'speaker' | 'tv' | 'console'

// Typ utifrån enhetens tillverkare och modell (från HA:s enhetsregister), sätts av HassProvider.
let kindHints: Record<string, MediaKind> = {}
export const setKindHints = (h: Record<string, MediaKind>) => {
  kindHints = h
}

/** Gissar typ utifrån tillverkare och modell, t.ex. Sonos One eller Google Nest Mini. */
export function kindFromDevice(manufacturer = '', model = ''): MediaKind | undefined {
  const t = `${manufacturer} ${model}`.toLowerCase()
  if (/playstation|sony interactive|xbox/.test(t)) return 'console'
  if (/chromecast|google tv|android tv|apple tv|shield|bravia|samsung|lg/.test(t)) return 'tv'
  if (/sonos|google home|nest mini|nest audio|nest hub|home mini|home max|speaker|homepod/.test(t)) return 'speaker'
  return undefined
}

export function mediaKind(e: HassEntity): MediaKind {
  if (config.mediaKind[e.entity_id]) return config.mediaKind[e.entity_id]
  if (kindHints[e.entity_id]) return kindHints[e.entity_id]
  const t = (nameOf(e) + ' ' + e.entity_id).toLowerCase()
  if (/playstation|ps5|ps4|xbox|switch_console/.test(t)) return 'console'
  if (/sonos|google home|google_home|nest|högtalare|hogtalare|speaker|homepod/.test(t)) return 'speaker'
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

const byId = (ents: HassEntities, re: RegExp, domain?: string, test?: (e: HassEntity) => boolean) =>
  Object.values(ents).find((e) => re.test(e.entity_id) && (!domain || domainOf(e.entity_id) === domain) && (!test || test(e)))

/** Skrivaren från ha-bambulab, eller undefined om ingen finns. */
export function bambu(ents: HassEntities) {
  const prog = config.bambu.prefix
    ? ents[`sensor.${config.bambu.prefix}_print_progress`]
    : byId(ents, /^sensor\..+_print_progress$/)
  if (!prog) return undefined
  const p = objectId(prog.entity_id).replace(/_print_progress$/, '')
  const s = (k: string) => ents[`sensor.${p}_${k}`]
  return {
    progress: num(prog),
    status: s('print_status')?.state ?? s('current_stage')?.state,
    remaining: num(s('remaining_time')),
    task: s('task_name')?.state,
    nozzle: num(s('nozzle_temperature')),
    bed: num(s('bed_temperature')),
    camera: ents[`camera.${p}_camera`] ?? ents[`image.${p}_cover_image`],
    plug: ents[config.bambu.plug],
    power: num(ents[config.bambu.power]),
  }
}

/** Badrumsfläkten (Fresh Intellivent SKY). */
export function bathroom(ents: HassEntities) {
  const c = config.bathroom
  const re = /intellivent|_sky_|fresh_sky/i
  const humidity = c.humidity ? ents[c.humidity] : byId(ents, re, 'sensor', (e) => e.attributes.device_class === 'humidity')
  if (!humidity) return undefined
  return {
    humidity: num(humidity),
    temperature: num(c.temperature ? ents[c.temperature] : byId(ents, re, 'sensor', (e) => e.attributes.device_class === 'temperature')),
    fan: c.fan ? ents[c.fan] : byId(ents, re, 'fan'),
    airing: c.airing ? ents[c.airing] : byId(ents, /(intellivent|sky).*(airing|boost|vadring)/i),
  }
}

export const alarmPanel = (ents: HassEntities) => Object.values(ents).find((e) => domainOf(e.entity_id) === 'alarm_control_panel')
export const cameras = (ents: HassEntities) => Object.values(ents).filter((e) => domainOf(e.entity_id) === 'camera' && visible(e.entity_id))
export const persons = (ents: HassEntities) => Object.values(ents).filter((e) => domainOf(e.entity_id) === 'person')
export const weather = (ents: HassEntities) => Object.values(ents).find((e) => domainOf(e.entity_id) === 'weather')

/** Medeltemperatur i ett rum, från temperaturgivare som ligger där. */
export function roomTemperature(ents: HassEntities, areaOf: Record<string, string>, areaId: string) {
  const vals = Object.values(ents)
    .filter((e) => areaOf[e.entity_id] === areaId && e.attributes.device_class === 'temperature' && domainOf(e.entity_id) === 'sensor')
    .map((e) => num(e))
    .filter((v): v is number => v !== undefined)
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : undefined
}

/** Google Wifi (eller annan router) via integrationen google_wifi. */
export function network(ents: HassEntities) {
  const status = Object.values(ents).find((e) => /^sensor\.google_wifi.*status$/.test(e.entity_id))
  if (!status) return undefined
  const uptime = Object.values(ents).find((e) => /^sensor\.google_wifi.*uptime$/.test(e.entity_id))
  const s = status.state.toLowerCase()
  return {
    online: s === 'online',
    unknown: s === 'unavailable' || s === 'unknown',
    uptimeDays: num(uptime),
  }
}

/** Enheter med lågt batteri (lås, sensorer, fjärrkontroller). */
export function lowBatteries(ents: HassEntities, limit = 20) {
  return Object.values(ents)
    .filter((e) => domainOf(e.entity_id) === 'sensor' && e.attributes.device_class === 'battery' && visible(e.entity_id))
    .map((e) => ({ e, level: num(e) }))
    .filter((b): b is { e: HassEntity; level: number } => b.level !== undefined && b.level <= limit)
    .sort((a, b) => a.level - b.level)
}

/** Alla med en person-entitet är borta (och det finns minst en). */
export function everyoneAway(ents: HassEntities) {
  const p = persons(ents)
  return p.length > 0 && p.every((e) => e.state !== 'home')
}

/** Saker som är igång och lätt glöms: mediaspelare, konsoler och datorer. Inte kyl, frys eller tvätt. */
export function forgottenOn(ents: HassEntities) {
  const media = mediaPlayers(ents).filter((e) => ['playing', 'paused', 'on', 'buffering'].includes(e.state))
  const pcs = computers(ents).filter((e) => e.state === 'on')
  return [...media, ...pcs]
}

/** Tillgängliga uppdateringar (update.*). */
export const updates = (ents: HassEntities) => Object.values(ents).filter((e) => domainOf(e.entity_id) === 'update' && e.state === 'on')

export const calendars = (ents: HassEntities) => Object.values(ents).filter((e) => domainOf(e.entity_id) === 'calendar' && visible(e.entity_id))

/**
 * Nästa sophämtning: en sensor med "sop", "avfall", "tömning" eller "waste" i namnet
 * vars värde är ett datum eller antal dagar kvar.
 */
export function wastePickups(ents: HassEntities) {
  const re = /sop|avfall|t[oö]mning|waste|garbage|trash|h[aä]mtning/i
  const out: { name: string; days: number }[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (const e of Object.values(ents)) {
    if (domainOf(e.entity_id) !== 'sensor' || !(re.test(e.entity_id) || re.test(nameOf(e)))) continue
    let days: number | undefined
    if (/^\d{4}-\d{2}-\d{2}/.test(e.state)) {
      const d = new Date(e.state.length === 10 ? `${e.state}T00:00` : e.state)
      d.setHours(0, 0, 0, 0)
      days = Math.round((d.getTime() - today.getTime()) / 86400_000)
    } else if (/^d|dag/i.test(String(e.attributes.unit_of_measurement ?? ''))) days = num(e)
    if (days !== undefined && days >= 0) out.push({ name: nameOf(e), days })
  }
  return out.sort((a, b) => a.days - b.days)
}
