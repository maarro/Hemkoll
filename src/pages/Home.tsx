import { useHass } from '../ha/HassProvider'
import { Alerts } from '../components/Alerts'
import { TileGrid } from '../components/EntityTile'
import { AlarmCard, ApplianceCards, BambuCard, BathroomCard, CameraStrip, NetworkCard } from '../components/HomeCards'
import { PowerPulse } from '../components/PowerPulse'
import { Scenes } from '../components/Scenes'
import { useFavorites } from '../ui/favorites'

/** Hem: husets puls, det som behöver uppmärksamhet, scener, favoriter och kameror. */
export function Home({ goEnergy }: { goEnergy: () => void }) {
  const { entities } = useHass()
  const favs = useFavorites().map((id) => entities[id]).filter(Boolean)

  return (
    <div className="stack">
      <PowerPulse onOpen={goEnergy} />
      <Alerts />
      <Scenes />
      <BambuCard />
      <div className="status-row">
        <AlarmCard />
        <BathroomCard />
        <ApplianceCards />
        <NetworkCard />
      </div>
      <section>
        <h2 className="section-title">Favoriter</h2>
        {favs.length ? <TileGrid list={favs} /> : <p className="empty">Håll inne på en enhet under Rum för att fästa den här.</p>}
      </section>
      <CameraStrip />
    </div>
  )
}
