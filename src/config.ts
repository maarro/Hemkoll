// Hemkoll – konfiguration
// Det mesta hittas automatiskt i Home Assistant. Här kan du skriva över
// gissningarna med dina riktiga entity_id:n när allt är installerat.

export const config = {
  /** Huvudmätaren från Tibber Pulse (W). Tom = hitta automatiskt (sensor.power_*). */
  mainPower: '',
  /** Elpriset från Tibber-integrationen. Tom = hitta automatiskt (sensor.electricity_price_*). */
  price: '',
  /** Dagens kostnad och förbrukning från Tibber. Tom = automatiskt. */
  costToday: '',
  consumptionToday: '',

  /**
   * Vitvaror på mätande uttag (Shelly Plug PM Gen3).
   * power = effektsensorn i W, running = input_boolean från HA-paketet hemkoll_tvattstuga.yaml
   */
  appliances: [
    { name: 'Tvättmaskin', icon: '🫧', verb: 'Tvättar', power: 'sensor.tvattmaskin_power', running: 'input_boolean.tvatt_pagar' },
    { name: 'Torktumlare', icon: '🌀', verb: 'Torkar', power: 'sensor.torktumlare_power', running: 'input_boolean.tork_pagar' },
  ],

  /**
   * Datorer. Vanligtvis en Wake-on-LAN-switch, valfritt med en
   * avstängningsknapp (HASS.Agent på Windows).
   * Tom lista = allt vars namn innehåller "dator", "pc" eller "mac".
   */
  computers: [] as string[],


  /**
   * Mediaspelare: typ styr vilken kontrollvy som visas.
   * Tom = gissas från namnet (Sonos/Home → högtalare, PlayStation → konsol, övrigt → TV).
   */
  mediaKind: {} as Record<string, 'speaker' | 'tv' | 'console'>,

  /** Fjärrkontroll per TV. Tom = remote.<samma namn> används automatiskt. */
  remotes: {} as Record<string, { remote: string; type: 'apple' | 'android' }>,

  /**
   * Snabbknappar för appar på Google TV (Android TV Remote: remote.turn_on med activity).
   * Värdet är appens paketnamn eller en länk. Lägg till dina favoriter.
   */
  tvApps: [
    { name: 'YouTube', activity: 'https://www.youtube.com' },
    { name: 'Netflix', activity: 'com.netflix.ninja' },
  ],

  /**
   * PlayStation: PSN-integrationen ger bara status. För att slå på/stänga av
   * krävs tillägget PS5-MQTT – ange dess switch här, t.ex. 'switch.ps5_power'.
   */
  consolePower: {} as Record<string, string>,

  /**
   * Scener på startsidan. Varje steg gör något med en lista entiteter.
   * do: 'on' | 'off' | 'play' | 'pause' | 'lock'. targets: entity_id:n, eller
   * 'allOn' = alla uttag och mediaspelare som är på just nu.
   * Entiteter som inte finns hoppas över, så scenerna går att köra direkt.
   */
  scenes: [
    {
      id: 'natt',
      name: 'God natt',
      icon: '🌙',
      steps: [
        { do: 'off', targets: ['switch.tv_bank', 'switch.deltaco_vardagsrum', 'media_player.apple_tv', 'media_player.google_tv', 'media_player.sonos_vardagsrum', 'media_player.sonos_kok'] },
        { do: 'lock', targets: ['lock.ytterdorr'] },
      ],
    },
    {
      id: 'borta',
      name: 'Lämna hemmet',
      icon: '🚪',
      steps: [
        { do: 'off', targets: 'allOn' },
        { do: 'lock', targets: ['lock.ytterdorr'] },
      ],
    },
    {
      id: 'film',
      name: 'Filmkväll',
      icon: '🍿',
      steps: [
        { do: 'on', targets: ['switch.tv_bank', 'media_player.apple_tv'] },
        { do: 'pause', targets: ['media_player.sonos_vardagsrum', 'media_player.sonos_kok'] },
        { do: 'off', targets: ['switch.deltaco_vardagsrum'] },
      ],
    },
    {
      id: 'hemma',
      name: 'Hemma igen',
      icon: '🏡',
      steps: [
        { do: 'on', targets: ['switch.deltaco_vardagsrum', 'switch.ikea_hall'] },
        { do: 'play', targets: ['media_player.sonos_kok'], source: 'P3' },
      ],
    },
  ] as SceneDef[],

  /**
   * Bambu Lab (integrationen ha-bambulab). Tom = hitta skrivaren automatiskt
   * (sensorn som slutar på _print_progress). plug/power = Shelly-uttaget skrivaren sitter i.
   */
  bambu: { prefix: '', plug: 'switch.bambu', power: 'sensor.bambu_power' },

  /** Badrumsfläkt (Fresh Intellivent SKY). Tomma = hittas automatiskt på namnet. */
  bathroom: { humidity: '', temperature: '', fan: '', airing: '' },

  /** Entiteter som aldrig ska visas (t.ex. kylskåpets uttag). */
  hidden: [] as string[],

  /** Manuell koppling uttag -> effektsensor, om automatiken inte hittar den. */
  powerFor: {} as Record<string, string>,
}

export type SceneStep = {
  do: 'on' | 'off' | 'play' | 'pause' | 'lock'
  targets: string[] | 'allOn'
  /** Vid play: spela denna källa/favorit (t.ex. 'P3'). */
  source?: string
}
export type SceneDef = { id: string; name: string; icon: string; steps: SceneStep[] }
