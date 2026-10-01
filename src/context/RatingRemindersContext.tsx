import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

type MatchNotice = { id: string; session_id: string; match_name: string; kind: 'cancelled' | 'ready' }
type Pending = { player_id: string; display_name: string; joined_at: string }
const Context = createContext<{ notices: MatchNotice[]; pending: Pending[]; error: boolean; refresh: () => Promise<void> }>({ notices: [], pending: [], error: false, refresh: async () => {} })

export function RatingRemindersProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [notices, setNotices] = useState<MatchNotice[]>([])
  const [pending, setPending] = useState<Pending[]>([])
  const [error, setError] = useState(false)
  const refresh = useCallback(async () => {
    if (!user) return
    const noticeResult = await supabase.from('match_notifications').select('id, session_id, match_name, kind').order('created_at', { ascending: false })
    if (!noticeResult.error) setNotices(noticeResult.data ?? [])
    const result = await supabase.rpc('get_pending_player_ratings')
    setError(Boolean(result.error || noticeResult.error))
    if (!result.error) setPending(result.data ?? [])
  }, [user?.id])
  useEffect(() => {
    setPending([]); setNotices([])
    void refresh()
    const visibleRefresh = () => { if (document.visibilityState === 'visible') void refresh() }
    const interval = window.setInterval(visibleRefresh, 15000)
    window.addEventListener('focus', visibleRefresh)
    document.addEventListener('visibilitychange', visibleRefresh)
    return () => { clearInterval(interval); window.removeEventListener('focus', visibleRefresh); document.removeEventListener('visibilitychange', visibleRefresh) }
  }, [refresh])
  return <Context.Provider value={{ notices, pending, error, refresh }}>{children}</Context.Provider>
}
export const useRatingReminders = () => useContext(Context)
