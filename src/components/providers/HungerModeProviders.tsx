'use client'
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react'
import { useTheme } from 'next-themes'

interface HungerModeCtx {
  hungerMode: boolean
  toggleHungerMode: () => void
}

const Ctx = createContext<HungerModeCtx>({
  hungerMode: false,
  toggleHungerMode: () => {},
})

export function HungerModeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [hungerMode, setHungerMode] = useState(false)
  const { setTheme } = useTheme()

  useEffect(() => {
    let enabled = false
    try {
      enabled = window.localStorage.getItem('f4l-hunger') === 'true'
    } catch {
      // Keep the default light appearance when browser storage is unavailable.
    }

    setHungerMode(enabled)
    document.documentElement.classList.toggle('hunger', enabled)
    setTheme(enabled ? 'dark' : 'light')
  }, [setTheme])

  const toggleHungerMode = useCallback(() => {
    const next = !hungerMode
    setHungerMode(next)
    document.documentElement.classList.toggle('hunger', next)
    setTheme(next ? 'dark' : 'light')
    try {
      window.localStorage.setItem('f4l-hunger', String(next))
    } catch {
      // The appearance still changes for this session without local storage.
    }
  }, [hungerMode, setTheme])

  return (
    <Ctx.Provider value={{ hungerMode, toggleHungerMode }}>
      {children}
    </Ctx.Provider>
  )
}

export const useHungerMode = () => useContext(Ctx)
