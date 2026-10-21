import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

type MatchNotice = { created_at: string; id: string; session_id: string; match_name: string; kind: 'cancelled' | 'ready' | 'vestiaire_predictions' | 'vestiaire_motm' | 'team_feedback' }
type Pending = { player_id: string; display_name: string; joined_at: string }
type Announcement = { announcement_key: string; created_at: string }
const Context = createContext<{ notices: MatchNotice[]; announcements: Announcement[]; pending: Pending[]; error: boolean; refresh: () => Promise<void>; isRead: (key: string, timestamp: string) => boolean; markRead: (keys: string[]) => Promise<boolean> }>({ notices: [], announcements: [], pending: [], error: false, refresh: async () => {}, isRead: () => false, markRead: async () => false })

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
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [pending, setPending] = useState<Pending[]>([])
  const [error, setError] = useState(false)
  const [reads, setReads] = useState<Record<string, string>>({})
  const currentUser = useRef(user?.id)
  currentUser.current = user?.id
  const version = useRef(0)
  const seen = useRef<{ userId: string | null; noticeIds: Set<string> | null; playerIds: Set<string> | null }>({ userId: null, noticeIds: null, playerIds: null })
  const refresh = useCallback(async () => {
    if (!user) return
    if (seen.current.userId !== user.id) seen.current = { userId: user.id, noticeIds: null, playerIds: null }
    const request = ++version.current
    const [noticeResult, result, receipts, announcementResult] = await Promise.all([
      supabase.from('match_notifications').select('id, session_id, match_name, kind, created_at').order('created_at', { ascending: false }),
      supabase.rpc('get_pending_player_ratings'),
      supabase.from('notification_reads').select('notification_key, read_at'),
      supabase.from('club_announcements').select('announcement_key, created_at').eq('announcement_key', 'club_sats_launch'),
    ])
    if (currentUser.current !== user.id || request !== version.current) return
    if (!receipts.error) setReads(Object.fromEntries((receipts.data ?? []).map(row => [row.notification_key, row.read_at])))
    let hasNew = false
    if (!announcementResult.error) setAnnouncements(announcementResult.data ?? [])
    if (!noticeResult.error) {
      const ids = new Set([...(noticeResult.data ?? []).map(notice => notice.id), ...(announcementResult.data ?? []).map(item => 'announcement:' + item.announcement_key)])
      hasNew = seen.current.noticeIds !== null && [...ids].some(id => !seen.current.noticeIds?.has(id))
      seen.current.noticeIds = ids
      setNotices(noticeResult.data ?? [])
    }
    setError(Boolean(result.error || noticeResult.error || receipts.error))
    if (!result.error) {
      const ids = new Set((result.data ?? []).map(player => player.player_id))
      hasNew = hasNew || (seen.current.playerIds !== null && [...ids].some(id => !seen.current.playerIds?.has(id)))
      seen.current.playerIds = ids
      setPending(result.data ?? [])
    }
    if (hasNew) playNotificationSound()
  }, [user?.id])
  useEffect(() => {
    setPending([]); setNotices([]); setAnnouncements([]); setReads({})
    void refresh()
    const visibleRefresh = () => { if (document.visibilityState === 'visible') void refresh() }
    const interval = window.setInterval(visibleRefresh, 15000)
    window.addEventListener('focus', visibleRefresh)
    document.addEventListener('visibilitychange', visibleRefresh)
    return () => { ++version.current; clearInterval(interval); window.removeEventListener('focus', visibleRefresh); document.removeEventListener('visibilitychange', visibleRefresh) }
  }, [refresh])
  const isRead = (key: string, timestamp: string) => Boolean(reads[key] && Date.parse(reads[key]) >= Date.parse(timestamp))
  const markRead = async (keys: string[]) => {
    if (!user || !keys.length) return false
    const result = await supabase.rpc('mark_notifications_read', { p_keys: keys })
    if (currentUser.current !== user.id) return false
    if (result.error) return false
    await refresh()
    return true
  }
  return <Context.Provider value={{ notices, pending, announcements, error, refresh, isRead, markRead }}>{children}</Context.Provider>
}
export const useRatingReminders = () => useContext(Context)
