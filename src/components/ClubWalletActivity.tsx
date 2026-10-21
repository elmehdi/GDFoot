import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useI18n } from '../context/LanguageContext'
import type { ClubWallet } from '../context/ClubWalletContext'

export default function ClubWalletActivity({ recent }: { recent: ClubWallet['entries'] }) {
  const { language } = useI18n()
  const fr = language === 'fr'
  const [showAll, setShowAll] = useState(false)
  const [allEntries, setAllEntries] = useState<ClubWallet['entries'] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  useEffect(() => {
    if (!showAll) return
    let cancelled = false
    setLoading(true); setError(false)
    void (async () => {
      try {
        const result = await supabase.rpc('get_club_wallet_activity')
        if (cancelled) return
        if (result.error) throw result.error
        setAllEntries(result.data as unknown as ClubWallet['entries'])
      } catch {
        if (!cancelled) { setError(true); setShowAll(false) }
      } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [showAll, recent])
  const entries = showAll && allEntries ? allEntries : recent
  const labels = {
    rating: fr ? 'Joueur noté' : 'Player rated',
    prediction: fr ? 'Pronostic du Vestiaire' : 'Locker Room prediction',
    motm: fr ? 'Vote Homme du match' : 'Man of the Match vote',
    light_mode: fr ? 'Mode clair débloqué' : 'Light mode unlocked',
  }
  return <details className="wallet-history"><summary>{fr ? 'Voir les mouvements' : 'View activity'}</summary>
    {entries.length ? <ul id="wallet-activity-list">{entries.map(entry => <li key={entry.id}><div><strong>{labels[entry.kind]}{entry.kind === 'rating' && entry.player_name ? ': ' + entry.player_name : ''}</strong><time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleDateString(fr ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short' })}</time></div><span className={entry.amount > 0 ? 'wallet-credit' : ''}>{entry.amount > 0 ? '+' : '−'}{Math.abs(entry.amount).toLocaleString(fr ? 'fr-FR' : 'en-GB')} sats</span></li>)}</ul> : <p>{fr ? 'Votre premier avis lancera le compteur.' : 'Your first rating gets the balance moving.'}</p>}
    {error && <p className="wallet-error" role="alert">{fr ? 'Impossible de charger tous les mouvements. Réessayez.' : 'Could not load all activity. Please try again.'}</p>}
    {recent.length >= 12 && <button type="button" className="bitcoin-back wallet-history-toggle" disabled={loading} aria-expanded={showAll} aria-controls="wallet-activity-list" onClick={() => setShowAll(value => !value)}>{loading ? (fr ? 'Chargement…' : 'Loading…') : showAll ? (fr ? 'Afficher les 12 derniers' : 'Show latest 12') : (fr ? 'Afficher tous les mouvements' : 'Show all activity')}</button>}
  </details>
}
