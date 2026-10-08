import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../context/LanguageContext'
import { useRatingReminders } from '../context/RatingRemindersContext'
import { supabase } from '../lib/supabase'
import type { Session } from '../lib/database.types'

export default function PostMatchActions({ match, canManage, disabled, onPendingChange }: {
  match: Session; canManage: boolean; disabled: boolean; onPendingChange: (pending: boolean) => void
}) {
  const { t } = useI18n()
  const { refresh: refreshNotifications } = useRatingReminders()
  const [round, setRound] = useState<{ motm_open: boolean; motm_closed: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const load = async () => {
    if (match.status !== 'completed' || match.cancelled_at) return
    setLoading(true)
    const result = await supabase.from('vestiaire_rounds').select('motm_open,motm_closed').eq('session_id', match.id).maybeSingle()
    if (result.error) setError(t('Could not load post-match voting. Please try again.'))
    else { setRound(result.data ?? { motm_open: false, motm_closed: false }); setError('') }
    setLoading(false)
  }
  useEffect(() => {
    setConfirming(false); void load()
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void load() }, 15000)
    return () => window.clearInterval(interval)
  }, [match.id, match.status])
  const finish = async () => {
    if (saving || disabled || !canManage) return
    setSaving(true); onPendingChange(true); setError('')
    try {
      const result = await supabase.rpc('advance_vestiaire_round', { p_session_id: match.id, p_action: 'end_match' })
      if (result.error) throw result.error
      setRound({ motm_open: true, motm_closed: false }); setConfirming(false)
      await refreshNotifications()
    } catch { setError(t('Could not open post-match votes. Please try again.')) }
    finally { setSaving(false); onPendingChange(false) }
  }
  if (match.status !== 'completed' || match.cancelled_at) return null
  return <section className="club-panel post-match-panel">
    <div><span className="overline">{t('AFTER THE GAME')}</span><h2>{round?.motm_open ? t('Post-match votes') : t('Finished playing?')}</h2><p>{round?.motm_open ? t('Choose your Man of the Match and leave optional team feedback in the Locker Room.') : canManage ? t('Close predictions and invite players to vote for Man of the Match and share optional feedback.') : t('The organizer or a super admin will open post-match voting after the game.')}</p></div>
    {error && <p className="form-error" role="alert">{error} <button className="text-link" onClick={() => void load()} disabled={saving}>{t('Try again')}</button></p>}
    {round?.motm_open ? <><p className="field-hint">{t('Players have been notified in the app.')}</p><Link className="primary-button" to={'/vestiaire/' + match.id}>{t('Open post-match votes')}</Link></> : !loading && canManage && round && (confirming ? <div><p>{t('End the match now? This closes predictions and sends voting and feedback notifications to joined players.')}</p><div className="button-row"><button className="primary-button" disabled={disabled || saving} onClick={() => void finish()}>{saving ? t('Please wait...') : t('End match & open votes')}</button><button className="secondary-button" disabled={saving} onClick={() => setConfirming(false)}>{t('Cancel')}</button></div></div> : <button className="primary-button" disabled={disabled} onClick={() => setConfirming(true)}>{t('End match & open votes')}</button>)}
  </section>
}
