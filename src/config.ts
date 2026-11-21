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

  /** Det som stängs av med "Stäng av allt"-knappen. Tom = alla uttag + mediaspelare. */
  leaveHomeOff: [] as string[],

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

  /** Entiteter som aldrig ska visas (t.ex. kylskåpets uttag). */
  hidden: [] as string[],

  /** Manuell koppling uttag -> effektsensor, om automatiken inte hittar den. */
  powerFor: {} as Record<string, string>,
}
