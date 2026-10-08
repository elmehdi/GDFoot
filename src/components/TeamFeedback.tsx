import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../context/LanguageContext'
import { useRatingReminders } from '../context/RatingRemindersContext'

type Response = 'happy' | 'mixed' | 'unhappy' | 'skipped'
type Summary = { happy: number; mixed: number; unhappy: number; comments: string[] }
const options = [{ value: 'happy', label: 'Happy' }, { value: 'mixed', label: 'Mixed' }, { value: 'unhappy', label: 'Unhappy' }] as const
export default function TeamFeedback({ matchId, joined, canManage }: { matchId: string; joined: boolean; canManage: boolean }) {
  const { user } = useAuth()
  const { t } = useI18n()
  const { refresh: refreshNotifications } = useRatingReminders()
  const [response, setResponse] = useState<Response | null>(null)
  const [comment, setComment] = useState('')
  const [saved, setSaved] = useState<Response | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const panel = useRef<HTMLElement>(null)
  const load = async () => {
    if (!user) return
    setLoading(true); setError('')
    const [own, totals] = await Promise.all([
      joined ? supabase.from('team_feedback').select('response,comment').eq('session_id', matchId).eq('player_id', user.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      canManage ? supabase.rpc('get_team_feedback_summary', { p_session_id: matchId }) : Promise.resolve({ data: null, error: null }),
    ])
    if (own.error || totals.error) setError(t('Could not load team feedback. Please try again.'))
    else {
      setResponse(own.data?.response ?? null); setSaved(own.data?.response ?? null); setComment(own.data?.comment ?? '')
      setSummary(totals.data?.[0] ?? null)
    }
    setLoading(false)
  }
  useEffect(() => { void load() }, [matchId, user?.id, joined, canManage])
  useEffect(() => {
    if (!loading && window.location.hash === '#team-feedback') panel.current?.scrollIntoView({ block: 'start' })
  }, [loading])
  const save = async (choice: Response) => {
    if (busy || !joined) return
    setBusy(true); setError('')
    const result = await supabase.rpc('save_team_feedback', { p_session_id: matchId, p_response: choice, p_comment: choice === 'skipped' ? '' : comment })
    if (result.error) setError(t('Could not save your feedback. Please try again.'))
    else { setEditing(false); await Promise.all([load(), refreshNotifications()]) }
    setBusy(false)
  }
  return <section id="team-feedback" ref={panel} className="club-panel team-feedback-panel">
    <span className="overline">{t('OPTIONAL FEEDBACK')}</span><h2>{t('Were you happy with your team?')}</h2>
    <p>{t('No pressure to answer. Managers see totals and comments without player names. This does not change skill ratings.')}</p>
    {error && <p className="form-error" role="alert">{error} <button className="text-link" disabled={busy} onClick={() => void load()}>{t('Try again')}</button></p>}
    {loading ? <p className="field-hint">{t('Loading...')}</p> : joined && (saved && !editing ? <div><p role="status">{saved === 'skipped' ? t('Feedback skipped. You can answer later if you want.') : t('Thanks! Your feedback is saved.')}</p><button className="text-link" onClick={() => setEditing(true)}>{saved === 'skipped' ? t('Give optional feedback') : t('Edit my feedback')}</button></div> : <><div className="feedback-options" role="group" aria-label={t('Team satisfaction')}>{options.map(option => <button type="button" className={response === option.value ? 'primary-button' : 'secondary-button'} key={option.value} aria-pressed={response === option.value} disabled={busy} onClick={() => setResponse(option.value)}>{t(option.label)}</button>)}</div><label className="feedback-comment">{t('Anything to add? (optional)')}<textarea className="input-field" rows={3} maxLength={500} value={comment} disabled={busy} onChange={event => setComment(event.target.value)} /></label><div className="button-row"><button className="primary-button" disabled={busy || !response || response === 'skipped'} onClick={() => response && void save(response)}>{busy ? t('Saving...') : t('Save feedback')}</button><button className="text-link" disabled={busy} onClick={() => void save('skipped')}>{t('Skip')}</button></div></>)}
    {canManage && summary && <div className="feedback-summary"><h3>{t('Team feedback summary')}</h3><div className="feedback-options">{options.map(option => <span key={option.value}><strong>{summary[option.value]}</strong> {t(option.label)}</span>)}</div>{summary.comments.length > 0 && <ul>{summary.comments.map((text, index) => <li key={index}>{text}</li>)}</ul>}<button className="text-link" disabled={busy} onClick={() => void load()}>{t('Refresh feedback')}</button></div>}
  </section>
}
