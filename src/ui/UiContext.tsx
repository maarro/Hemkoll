import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

type Ui = {
  openMedia: (id: string) => void
  openAlarm: (id: string) => void
  openCamera: (id: string) => void
  toast: (msg: string) => void
}

type Sheet = { kind: 'media' | 'alarm' | 'camera'; id: string } | null

const Ctx = createContext<Ui | null>(null)

export function useUi() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useUi måste användas inom <UiProvider>')
  return v
}

/** Gemensamt för hela appen: kontrollvyn för media och korta bekräftelser. */
export function UiProvider({
  children,
  renderSheet,
}: {
  children: ReactNode
  renderSheet: (kind: 'media' | 'alarm' | 'camera', id: string, close: () => void) => ReactNode
}) {
  const [sheet, setSheet] = useState<Sheet>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const toast = useCallback((m: string) => {
    setMsg(m)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setMsg(null), 2600)
  }, [])

  return (
    <Ctx.Provider
      value={{
        openMedia: (id) => setSheet({ kind: 'media', id }),
        openAlarm: (id) => setSheet({ kind: 'alarm', id }),
        openCamera: (id) => setSheet({ kind: 'camera', id }),
        toast,
      }}
    >
      {children}
      {sheet && renderSheet(sheet.kind, sheet.id, () => setSheet(null))}
      {msg && (
        <div className="toast" role="status">
          {msg}
        </div>
      )}
    </Ctx.Provider>
  )
}
