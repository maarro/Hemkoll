import type { SceneDef } from '../config'
import { domainOf, mediaPlayers, plugs } from './selectors'
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
