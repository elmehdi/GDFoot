import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useRatingReminders } from '../context/RatingRemindersContext'
import { useI18n } from '../context/LanguageContext'

export default function RatingNotifications() {
  const { pending, notices, error, refresh } = useRatingReminders()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const noticeText = (kind: string) => kind === 'team_feedback'
    ? { title: t('Were you happy with your team?'), action: t('Give optional feedback') }
    : kind === 'vestiaire_predictions'
    ? { title: t('Vote on Locker Room predictions'), action: t('Answer the six questions') }
    : kind === 'vestiaire_motm'
      ? { title: t('Man of the Match voting is open'), action: t('Choose your Man of the Match') }
      : kind === 'ready'
        ? { title: t('Teams ready'), action: t('See your team') }
        : { title: t('Match cancelled'), action: t('View match') }
  return <div className="rating-notifications" onKeyDown={event => { if (event.key === 'Escape') setOpen(false) }}>
    <button className="icon-button notification-toggle" aria-label={t('Notifications') + (pending.length + notices.length ? ': ' + (pending.length + notices.length) : '')} aria-expanded={open} aria-controls="rating-notification-list" onClick={() => setOpen(!open)}>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
      {pending.length + notices.length > 0 && <span className="notification-count">{pending.length + notices.length}</span>}
    </button>
    {open && <section id="rating-notification-list" className="notification-panel" aria-label={t('Rating notifications')}>
      <div className="section-heading"><strong>{t('Notifications')}</strong><button className="text-link" onClick={() => setOpen(false)} aria-label={t('Close')}>×</button></div>
      {notices.length > 0 && <ul>{notices.map(notice => <li key={notice.id}><Link to={((notice.kind.startsWith('vestiaire_') || notice.kind === 'team_feedback') ? '/vestiaire/' : notice.kind === 'ready' ? '/results/' : '/session/') + notice.session_id + (notice.kind === 'team_feedback' ? '#team-feedback' : '')} onClick={() => setOpen(false)}><strong>{noticeText(notice.kind).title}: {notice.match_name}</strong><span>{noticeText(notice.kind).action} →</span></Link></li>)}</ul>}
      {error ? <button className="text-link" onClick={() => void refresh()}>{t('Could not load notifications. Retry')}</button> : pending.length > 0 ? <><p>{t('These players have joined the club. Add your private rating.')}</p><ul>{pending.map(player => <li key={player.player_id}><Link to={'/ratings?player=' + player.player_id} onClick={() => setOpen(false)}><strong>{player.display_name}</strong><span>{t('Rate this player')} →</span></Link></li>)}</ul></> : notices.length === 0 ? <p>{t('All caught up. No players left to rate.')}</p> : null}
    </section>}
  </div>
}
