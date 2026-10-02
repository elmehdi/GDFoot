import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

type MatchNotice = { id: string; session_id: string; match_name: string; kind: 'cancelled' | 'ready' | 'vestiaire_predictions' | 'vestiaire_motm' }
type Pending = { player_id: string; display_name: string; joined_at: string }
const Context = createContext<{ notices: MatchNotice[]; pending: Pending[]; error: boolean; refresh: () => Promise<void> }>({ notices: [], pending: [], error: false, refresh: async () => {} })

function playNotificationSound() {
  try {
    const audio = new AudioContext()
    const oscillator = audio.createOscillator()
    const volume = audio.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(660, audio.currentTime)
    oscillator.frequency.setValueAtTime(880, audio.currentTime + 0.12)
    volume.gain.setValueAtTime(0.0001, audio.currentTime)
    volume.gain.exponentialRampToValueAtTime(0.08, audio.currentTime + 0.02)
    volume.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.3)
    oscillator.connect(volume).connect(audio.destination)
    oscillator.start()
    oscillator.stop(audio.currentTime + 0.3)
    oscillator.onended = () => { void audio.close() }
    void audio.resume().catch(() => { void audio.close() })
  } catch {
    // Browsers may block audio until the user interacts with the page.
  }
}

export function RatingRemindersProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [notices, setNotices] = useState<MatchNotice[]>([])
  const [pending, setPending] = useState<Pending[]>([])
  const [error, setError] = useState(false)
  const seen = useRef<{ userId: string | null; noticeIds: Set<string> | null; playerIds: Set<string> | null }>({ userId: null, noticeIds: null, playerIds: null })
  const refresh = useCallback(async () => {
    if (!user) return
    if (seen.current.userId !== user.id) seen.current = { userId: user.id, noticeIds: null, playerIds: null }
    const noticeResult = await supabase.from('match_notifications').select('id, session_id, match_name, kind').order('created_at', { ascending: false })
    let hasNew = false
    if (!noticeResult.error) {
      const ids = new Set((noticeResult.data ?? []).map(notice => notice.id))
      hasNew = seen.current.noticeIds !== null && [...ids].some(id => !seen.current.noticeIds?.has(id))
      seen.current.noticeIds = ids
      setNotices(noticeResult.data ?? [])
    }
    const result = await supabase.rpc('get_pending_player_ratings')
    setError(Boolean(result.error || noticeResult.error))
    if (!result.error) {
      const ids = new Set((result.data ?? []).map(player => player.player_id))
      hasNew = hasNew || (seen.current.playerIds !== null && [...ids].some(id => !seen.current.playerIds?.has(id)))
      seen.current.playerIds = ids
      setPending(result.data ?? [])
    }
    if (hasNew) playNotificationSound()
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
