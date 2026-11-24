// Delade hjälpare för hur värden skrivs ut.

export const watts = (w?: number) =>
  w === undefined ? '–' : w >= 1000 ? `${(w / 1000).toLocaleString('sv-SE', { maximumFractionDigits: 2 })} kW` : `${Math.round(w)} W`

export const stateSv: Record<string, string> = {
  playing: 'Spelar',
  paused: 'Pausad',
  idle: 'Redo',
  on: 'På',
  off: 'Av',
  standby: 'Viloläge',
  unavailable: 'Ej tillgänglig',
  locked: 'Låst',
  unlocked: 'Olåst',
  locking: 'Låser…',
  unlocking: 'Låser upp…',
  jammed: 'Har fastnat',
  open: 'Öppen',
  disarmed: 'Avlarmat',
  armed_away: 'Larmat, borta',
  armed_home: 'Larmat, hemma',
  armed_night: 'Larmat, natt',
  arming: 'Larmar på…',
  pending: 'Väntar…',
  triggered: 'Larmet har gått',
}
