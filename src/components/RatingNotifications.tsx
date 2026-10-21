import { Link } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useRatingReminders } from '../context/RatingRemindersContext'
import { useI18n } from '../context/LanguageContext'

export default function RatingNotifications() {
  const { pending, notices, error, refresh, isRead, markRead } = useRatingReminders()
  const { t, language } = useI18n()
  const fr = language === 'fr'
  const unreadKeys = [...notices.filter(n => !isRead('notice:' + n.id, n.created_at)).map(n => 'notice:' + n.id), ...pending.filter(p => !isRead('rating:' + p.player_id, p.joined_at)).map(p => 'rating:' + p.player_id)]
  const [reading, setReading] = useState(false)
  const [readError, setReadError] = useState(false)
  const read = async (keys: string[]) => {
    setReading(true); setReadError(false)
    try { if (!await markRead(keys)) setReadError(true) } catch { setReadError(true) }
    finally { setReading(false) }
  }
  const readControl = (key: string, timestamp: string) => isRead(key, timestamp)
    ? <span className="notification-read-label">{fr ? 'Lu' : 'Read'}</span>
    : <button type="button" className="text-link notification-read-action" disabled={reading} onClick={() => void read([key])}>{fr ? 'Marquer comme lu' : 'Mark as read'}</button>
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) setOpen(false)
    }
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', dismissOutside, true)
    document.addEventListener('keydown', dismissOnEscape)
    return () => {
      document.removeEventListener('pointerdown', dismissOutside, true)
      document.removeEventListener('keydown', dismissOnEscape)
    }
  }, [open])
  const noticeText = (kind: string) => kind === 'team_feedback'
    ? { title: t('Were you happy with your team?'), action: t('Give optional feedback') }
    : kind === 'vestiaire_predictions'
    ? { title: t('Vote on Locker Room predictions'), action: t('Answer the six questions') }
    : kind === 'vestiaire_motm'
      ? { title: t('Man of the Match voting is open'), action: t('Choose your Man of the Match') }
      : kind === 'ready'
        ? { title: t('Teams ready'), action: t('See your team') }
        : { title: t('Match cancelled'), action: t('View match') }
  return <div ref={containerRef} className="rating-notifications">
    <button className="icon-button notification-toggle" aria-label={t('Notifications') + (unreadKeys.length ? ': ' + (unreadKeys.length) : '')} aria-expanded={open} aria-controls="rating-notification-list" onClick={() => setOpen(!open)}>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
      {unreadKeys.length > 0 && <span className="notification-count">{unreadKeys.length}</span>}
    </button>
    {open && <section id="rating-notification-list" className="notification-panel" aria-label={t('Rating notifications')}>
      <div className="section-heading"><strong>{t('Notifications')}</strong><button className="text-link" onClick={() => setOpen(false)} aria-label={t('Close')}>×</button></div>
      {unreadKeys.length > 0 && <button type="button" className="text-link notification-mark-all" disabled={reading} onClick={() => void read(unreadKeys)}>{fr ? 'Tout marquer comme lu' : 'Mark all as read'}</button>}
      {readError && <p role="alert">{fr ? 'Lecture non enregistrée. Réessayez.' : 'Could not save read status. Please try again.'}</p>}
      <div className="notification-content">
      {notices.length > 0 && <ul>{notices.map(notice => <li key={notice.id} className={isRead('notice:' + notice.id, notice.created_at) ? 'is-read' : 'is-unread'}><Link to={((notice.kind.startsWith('vestiaire_') || notice.kind === 'team_feedback') ? '/vestiaire/' : notice.kind === 'ready' ? '/results/' : '/session/') + notice.session_id + (notice.kind === 'team_feedback' ? '#team-feedback' : '')} onClick={() => { void read(['notice:' + notice.id]); setOpen(false) }}><strong>{noticeText(notice.kind).title}: {notice.match_name}</strong><span>{noticeText(notice.kind).action} →</span></Link>{readControl('notice:' + notice.id, notice.created_at)}</li>)}</ul>}
      {error ? <button className="text-link" onClick={() => void refresh()}>{t('Could not load notifications. Retry')}</button> : pending.length > 0 ? <><p>{t('These players have joined the club. Add your private rating.')}</p><ul>{pending.map(player => <li key={player.player_id} className={isRead('rating:' + player.player_id, player.joined_at) ? 'is-read' : 'is-unread'}><Link to={'/ratings?player=' + player.player_id} onClick={() => { void read(['rating:' + player.player_id]); setOpen(false) }}><strong>{player.display_name}</strong><span>{t('Rate this player')} →</span></Link>{readControl('rating:' + player.player_id, player.joined_at)}</li>)}</ul></> : notices.length === 0 ? <p>{t('All caught up. No players left to rate.')}</p> : null}
      </div>
    </section>}
  </div>
}
