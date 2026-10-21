import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { useClubWallet } from './ClubWalletContext'

type Theme = 'light' | 'dark'
type ThemeState = { theme: Theme; secondsLeft: number; lightModeUnlocked: boolean; startTrial: () => void; endTrial: () => void; enableLightMode: () => void }
const ThemeContext = createContext<ThemeState | null>(null)
function trialExpiry(key: string) {
  try {
    const expiry = Number(sessionStorage.getItem(key))
    return Number.isFinite(expiry) && expiry > Date.now() ? expiry : null
  } catch { return null }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const { wallet } = useClubWallet()
  const lightModeUnlocked = wallet?.light_mode_unlocked ?? false
  const userId = user?.id ?? null
  const trialKey = 'foot-light-trial-until-' + userId
  const [trialUser, setTrialUser] = useState(userId)
  const [expiresAt, setExpiresAt] = useState<number | null>(() => trialExpiry(trialKey))
  const [now, setNow] = useState(Date.now)
  const [preference, setPreference] = useState<{ userId: string | null; theme: Theme } | null>(null)
  useEffect(() => {
    let saved: Theme = 'light'
    try { if (localStorage.getItem('foot-theme-' + userId) === 'dark') saved = 'dark' } catch { /* Use the default. */ }
    setPreference({ userId, theme: saved })
    setTrialUser(userId)
    setNow(Date.now())
    setExpiresAt(trialExpiry(trialKey))
  }, [userId, trialKey])
  const savePreference = (theme: Theme) => {
    setPreference({ userId, theme })
    try { localStorage.setItem('foot-theme-' + userId, theme) } catch { /* This page still switches. */ }
  }
  const secondsLeft = trialUser === userId && !lightModeUnlocked && expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : 0
  const theme: Theme = lightModeUnlocked ? (preference?.userId === userId ? preference.theme : 'light') : secondsLeft > 0 ? 'light' : 'dark'

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
  }, [expiresAt, trialKey])

  const startTrial = () => {
    if (lightModeUnlocked) { savePreference('light'); return }
    const expiry = Date.now() + 8_000
    try { sessionStorage.setItem(trialKey, String(expiry)) } catch { /* The trial works for this page. */ }
    setNow(Date.now())
    setTrialUser(userId)
    setExpiresAt(expiry)
  }
  const endTrial = () => {
    if (lightModeUnlocked) savePreference('dark')
    try { sessionStorage.removeItem(trialKey) } catch { /* The trial still ends. */ }
    setExpiresAt(null)
  }

  const enableLightMode = () => { if (lightModeUnlocked) savePreference('light') }
  return <ThemeContext.Provider value={{ theme, secondsLeft, lightModeUnlocked, startTrial, endTrial, enableLightMode }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('ThemeProvider is missing')
  return context
}
