import {
  Clapperboard,
  Coffee,
  DoorOpen,
  Fan,
  Gamepad2,
  House,
  Lamp,
  Laptop,
  Lock,
  LockOpen,
  Moon,
  Plug,
  Printer,
  ShieldCheck,
  Sparkles,
  Speaker,
  Tv,
  WashingMachine,
  Wind,
  type LucideIcon,
} from 'lucide-react'
import { mediaKind, nameOf, domainOf } from '../ha/selectors'
import type { HassEntity } from '../ha/types'

/** Ikon för en enhet, utifrån typ och namn. */
export function iconFor(e: HassEntity, isComputer = false): LucideIcon {
  const d = domainOf(e.entity_id)
  const n = (nameOf(e) + ' ' + e.entity_id).toLowerCase()
  if (d === 'lock') return e.state === 'locked' ? Lock : LockOpen
  if (d === 'alarm_control_panel') return ShieldCheck
  if (d === 'fan') return Fan
  if (d === 'media_player') {
    const k = mediaKind(e)
    return k === 'speaker' ? Speaker : k === 'console' ? Gamepad2 : Tv
  }
  if (isComputer) return Laptop
  if (/bambu|skrivare|printer|p1s|x1c|a1/.test(n)) return Printer
  if (/kaffe|coffee/.test(n)) return Coffee
  if (/\btv|tv-|tv_/.test(n)) return Tv
  if (d === 'light' || /lamp|ljus|light/.test(n)) return Lamp
  return Plug
}

const sceneIcons: Record<string, LucideIcon> = { natt: Moon, borta: DoorOpen, film: Clapperboard, hemma: House }
export const sceneIcon = (id: string): LucideIcon => sceneIcons[id] ?? Sparkles

/** Ikon för en vitvara utifrån namnet. */
export const applianceIcon = (name: string): LucideIcon => (/tork|dryer/i.test(name) ? Wind : WashingMachine)
