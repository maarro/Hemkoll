import { config, type SceneDef } from '../config'
import type { LucideIcon } from 'lucide-react'
import { sceneIcon, sceneIconByName } from '../ui/icons'
import { domainOf, mediaPlayers, nameOf, plugs } from './selectors'
import type { Hass, HassEntities } from './types'

/** Kör en scen. Returnerar hur många saker som påverkades. */
export async function runScene(scene: SceneDef, entities: HassEntities, callService: Hass['callService']) {
  let count = 0
  for (const step of scene.steps) {
    const ids =
      step.targets === 'allOn'
        ? [...plugs(entities), ...mediaPlayers(entities)].filter((e) => !['off', 'unavailable', 'standby'].includes(e.state)).map((e) => e.entity_id)
        : step.targets.filter((id) => entities[id])
    if (!ids.length) continue
    const target = { entity_id: ids }
    switch (step.do) {
      case 'on':
        await callService('homeassistant', 'turn_on', {}, target)
        break
      case 'off':
        await callService('homeassistant', 'turn_off', {}, target)
        break
      case 'pause':
        await callService('media_player', 'media_pause', {}, { entity_id: ids.filter((i) => entities[i]?.state === 'playing') })
        break
      case 'play':
        if (step.source) await callService('media_player', 'select_source', { source: step.source }, target)
        else await callService('media_player', 'media_play', {}, target)
        break
      case 'lock':
        await callService('lock', 'lock', {}, { entity_id: ids.filter((i) => domainOf(i) === 'lock' && entities[i]?.state !== 'locked') })
        break
    }
    count += ids.length
  }
  return count
}

export interface SceneButton {
  id: string
  name: string
  icon: LucideIcon
  /** Kör scenen. Returnerar antal saker som påverkades, eller undefined om okänt. */
  run: () => Promise<number | undefined>
}

/**
 * Scenknapparna på Hem.
 * Riktigt läge: scener och skript från Home Assistant (de du skapar under
 * Automatiseringar och scener). Hemkolls egna interna skript (script.hemkoll_*) och
 * dolda entiteter visas inte.
 * Demoläge: de inbyggda exempelscenerna i config.ts.
 */
export function sceneButtons(entities: HassEntities, callService: Hass['callService'], demo: boolean, noise: Set<string>): SceneButton[] {
  if (demo)
    return config.scenes.map((s) => ({
      id: s.id,
      name: s.name,
      icon: sceneIcon(s.id),
      run: () => runScene(s, entities, callService),
    }))
  return Object.values(entities)
    .filter((e) => ['scene', 'script'].includes(domainOf(e.entity_id)))
    .filter((e) => !e.entity_id.startsWith('script.hemkoll_') && !noise.has(e.entity_id) && !config.hidden.includes(e.entity_id))
    .filter((e) => e.state !== 'unavailable')
    .sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'sv'))
    .map((e) => ({
      id: e.entity_id,
      name: nameOf(e),
      icon: sceneIconByName(nameOf(e)),
      run: async () => {
        await callService(domainOf(e.entity_id), 'turn_on', {}, { entity_id: e.entity_id })
        return undefined
      },
    }))
}
