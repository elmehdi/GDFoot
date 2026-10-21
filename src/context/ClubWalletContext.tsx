import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

export type ClubWallet = {
  balance: number
  earned: number
  light_mode_price: number
  light_mode_unlocked: boolean
  rating_reward: number
  vote_reward: number
  entries: { id: string; kind: 'rating' | 'prediction' | 'motm' | 'light_mode'; amount: number; created_at: string; player_name?: string | null }[]
}
type WalletState = {
  wallet: ClubWallet | null; loading: boolean; error: boolean; reward: number
  refresh: () => Promise<void>; unlockLightMode: () => Promise<void>
}
const Context = createContext<WalletState | null>(null)

export function ClubWalletProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const currentUser = useRef(userId)
  currentUser.current = userId
  const request = useRef(0)
  const [state, setState] = useState<{ userId: string; wallet: ClubWallet } | null>(null)
  const previousEarned = useRef<{ userId: string; value: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reward, setReward] = useState(0)
  const refresh = useCallback(async () => {
    if (!userId) return
    const version = ++request.current
    try {
      const result = await supabase.rpc('get_club_wallet')
      if (currentUser.current !== userId || version !== request.current) return
      if (result.error) throw result.error
      const wallet = result.data as unknown as ClubWallet
      const previous = previousEarned.current
      if (previous?.userId === userId && wallet.earned > previous.value) setReward(wallet.earned - previous.value)
      previousEarned.current = { userId, value: wallet.earned }
      setState({ userId, wallet })
      setError(false)
    } catch {
      if (currentUser.current === userId && version === request.current) setError(true)
    } finally {
      if (currentUser.current === userId && version === request.current) setLoading(false)
    }
  }, [userId])
  useEffect(() => {
    setLoading(true); setError(false); setReward(0)
    setState(null); previousEarned.current = null
    if (!userId) { setLoading(false); return }
    void refresh()
    const onFocus = () => { if (document.visibilityState === 'visible') void refresh() }
    const timer = window.setInterval(onFocus, 30000)
    window.addEventListener('focus', onFocus)
    return () => { ++request.current; clearInterval(timer); window.removeEventListener('focus', onFocus) }
  }, [refresh, userId])
  useEffect(() => {
    if (!reward) return
    const timer = window.setTimeout(() => setReward(0), 5000)
    return () => clearTimeout(timer)
  }, [reward])
  const unlockLightMode = async () => {
    if (!userId) throw new Error('Sign in first')
    const result = await supabase.rpc('unlock_club_light_mode')
    if (currentUser.current !== userId) return
    if (result.error) throw result.error
    ++request.current
    const wallet = result.data as unknown as ClubWallet
    previousEarned.current = { userId, value: wallet.earned }
    setState({ userId, wallet }); setError(false); setLoading(false)
  }
  const wallet = state?.userId === userId ? state.wallet : null
  return <Context.Provider value={{ wallet, loading, error, reward: wallet ? reward : 0, refresh, unlockLightMode }}>{children}</Context.Provider>
}

export function useClubWallet() {
  const value = useContext(Context)
  if (!value) throw new Error('ClubWalletProvider is missing')
  return value
}
