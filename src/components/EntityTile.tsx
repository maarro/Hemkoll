import { useHass } from '../ha/HassProvider'
import { computers, domainOf, nameOf } from '../ha/selectors'
import type { HassEntity } from '../ha/types'
import { toggleFavorite, useFavorites } from '../ui/favorites'
import { useUi } from '../ui/UiContext'
import { useLongPress } from '../ui/useLongPress'
import { ComputerTile, LockTile, MediaTile, PlugTile } from './Tiles'

/** Rätt ruta för varje sorts enhet. Håll inne för att fästa/lossa som favorit. */
export function EntityTile({ entity }: { entity: HassEntity }) {
  const { entities } = useHass()
  const { openMedia, toast } = useUi()
  const favs = useFavorites()
  const fav = favs.includes(entity.entity_id)
  const press = useLongPress(() => {
    toggleFavorite(entity.entity_id)
    toast(fav ? `${nameOf(entity)} borttagen från favoriter` : `★ ${nameOf(entity)} fäst på startsidan`)
  })

  const d = domainOf(entity.entity_id)
  const isComputer = computers(entities).some((c) => c.entity_id === entity.entity_id)
  let tile
  if (d === 'media_player') tile = <MediaTile entity={entity} onOpen={() => openMedia(entity.entity_id)} />
  else if (d === 'lock') tile = <LockTile entity={entity} />
  else if (isComputer) tile = <ComputerTile entity={entity} />
  else tile = <PlugTile entity={entity} />

  return (
    <div className={`tile-wrap ${fav ? 'fav' : ''}`} {...press}>
      {tile}
    </div>
  )
}

/** Domäner som går att styra och därför visas i rum och favoriter. */
export const CONTROLLABLE = ['switch', 'light', 'fan', 'media_player', 'lock']
