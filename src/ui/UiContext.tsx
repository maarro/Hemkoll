import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

type Ui = {
  openMedia: (id: string) => void
  toast: (msg: string) => void
}

const Ctx = createContext<Ui | null>(null)

export function useUi() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useUi måste användas inom <UiProvider>')
  return v
}

/** Gemensamt för hela appen: kontrollvyn för media och korta bekräftelser. */
export function UiProvider({ children, renderMedia }: { children: ReactNode; renderMedia: (id: string, close: () => void) => ReactNode }) {
  const [media, setMedia] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const toast = useCallback((m: string) => {
    setMsg(m)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setMsg(null), 2600)
  }, [])

  return (
    <Ctx.Provider value={{ openMedia: setMedia, toast }}>
      {children}
      {media && renderMedia(media, () => setMedia(null))}
      {msg && (
        <div className="toast" role="status">
          {msg}
        </div>
      )}
    </Ctx.Provider>
  )
}
