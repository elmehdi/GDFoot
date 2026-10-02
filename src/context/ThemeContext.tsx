import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'
type ThemeState = { theme: Theme; secondsLeft: number; startTrial: () => void; endTrial: () => void }
const ThemeContext = createContext<ThemeState | null>(null)
const trialKey = 'foot-light-trial-until'

function trialExpiry() {
  try {
    const expiry = Number(sessionStorage.getItem(trialKey))
    return Number.isFinite(expiry) && expiry > Date.now() ? expiry : null
  } catch { return null }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [expiresAt, setExpiresAt] = useState<number | null>(trialExpiry)
  const [now, setNow] = useState(Date.now)
  const secondsLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : 0
  const theme: Theme = secondsLeft > 0 ? 'light' : 'dark'

  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])
  useEffect(() => {
    if (!expiresAt) return
    const timer = window.setInterval(() => {
      const current = Date.now()
      setNow(current)
      if (current >= expiresAt) {
        setExpiresAt(null)
        try { sessionStorage.removeItem(trialKey) } catch { /* The timer still expires. */ }
      }
    }, 100)
    return () => window.clearInterval(timer)
  }, [expiresAt])

  const startTrial = () => {
    const expiry = Date.now() + 4_000
    try { sessionStorage.setItem(trialKey, String(expiry)) } catch { /* The trial works for this page. */ }
    setNow(Date.now())
    setExpiresAt(expiry)
  }
  const endTrial = () => {
    try { sessionStorage.removeItem(trialKey) } catch { /* The trial still ends. */ }
    setExpiresAt(null)
  }

  return <ThemeContext.Provider value={{ theme, secondsLeft, startTrial, endTrial }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('ThemeProvider is missing')
  return context
}
