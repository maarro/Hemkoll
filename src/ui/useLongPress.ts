import { useRef } from 'react'

/**
 * Håll inne ~0,5 s. Returnerar props att sprida på elementet.
 * Ett vanligt klick efter en lång tryckning stoppas, så att t.ex. kontrollvyn inte öppnas.
 */
export function useLongPress(onLongPress: () => void, ms = 500) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const fired = useRef(false)
  const start = useRef<{ x: number; y: number } | null>(null)

  const clear = () => clearTimeout(timer.current)

  return {
    onPointerDown: (e: React.PointerEvent) => {
      fired.current = false
      start.current = { x: e.clientX, y: e.clientY }
      clear()
      timer.current = setTimeout(() => {
        fired.current = true
        try {
          navigator.vibrate?.(15)
        } catch {
          /* inte alla telefoner kan vibrera */
        }
        onLongPress()
      }, ms)
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) clear()
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onClickCapture: (e: React.MouseEvent) => {
      if (fired.current) {
        e.stopPropagation()
        e.preventDefault()
        fired.current = false
      }
    },
  }
}
