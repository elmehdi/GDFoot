import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useRatingReminders } from '../context/RatingRemindersContext'
import { useI18n } from '../context/LanguageContext'
import { supabase } from '../lib/supabase'
import { predictionQuestions } from '../lib/vestiaire'
import type { Session } from '../lib/database.types'
import Avatar from '../components/Avatar'
import Icon from '../components/Icon'
import TeamFeedback from '../components/TeamFeedback'

type Player = { id: string; name: string }
type Round = { predictions_closed: boolean; motm_open: boolean; motm_closed: boolean }
type Result = { question_key: string; place: number; player_id: string; display_name: string }
type MatchRow = Pick<Session, 'id' | 'name' | 'created_by' | 'scheduled_at' | 'cancelled_at'> & { session_players: { player_id: string }[]; round?: Round & { updated_at: string } }

const check = <T,>(stage: string, result: { data: T; error: { message: string; code?: string } | null }): T => {
  if (result.error) throw new Error(`${stage}: ${result.error.message}${result.error.code ? ` (${result.error.code})` : ''}`)
  return result.data
}

export default function Vestiaire() {
  const { id } = useParams<{ id: string }>()
  const [params, setParams] = useSearchParams()
  const { user } = useAuth()
  const { refresh: refreshNotifications } = useRatingReminders()
  const { language } = useI18n()
  const fr = language === 'fr'
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [match, setMatch] = useState<Session | null>(null)
  const [canManageTeams, setCanManageTeams] = useState(false)
  const [players, setPlayers] = useState<Player[]>([])
  const [round, setRound] = useState<Round>({ predictions_closed: false, motm_open: false, motm_closed: false })
  const [votes, setVotes] = useState<Record<string, string>>({})
  const [results, setResults] = useState<Result[]>([])
  const [questionIndex, setQuestionIndex] = useState(0)
  const [predictionsFinished, setPredictionsFinished] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmAction, setConfirmAction] = useState<string | null>(null)
  const listView = params.get('view') === 'history' ? 'history' : 'active'
  const [search, setSearch] = useState('')

  const refresh = async () => {
    if (!user) return
    try {
      if (!id) {
        const [response, roundsResponse, adminResult] = await Promise.all([supabase.from('sessions')
          .select('id,name,created_by,scheduled_at,cancelled_at,session_players!session_players_session_id_fkey(player_id)')
          .order('created_at', { ascending: false }),
          supabase.from('vestiaire_rounds').select('session_id,predictions_closed,motm_open,motm_closed,updated_at'),
          supabase.rpc('is_match_super_admin'),
        ])
        const data = check('matches', response)
        const rounds = check('rounds', roundsResponse)
        const isAdmin = check('permissions', adminResult)
        const roundsByMatch = new Map((rounds ?? []).map(item => [item.session_id, item]))
        setMatches(((data ?? []) as MatchRow[]).filter(item => !item.cancelled_at && (isAdmin || item.created_by === user.id || item.session_players.some(player => player.player_id === user.id))).map(item => ({ ...item, round: roundsByMatch.get(item.id) })))
      } else {
        const [matchResult, rosterResult, roundResult, voteResult, managerResult] = await Promise.all([
          supabase.from('sessions').select('*').eq('id', id).single(),
          supabase.from('session_players').select('player_id, profiles!session_players_player_id_fkey(display_name)').eq('session_id', id),
          supabase.from('vestiaire_rounds').select('predictions_closed,motm_open,motm_closed').eq('session_id', id).maybeSingle(),
          supabase.from('vestiaire_votes').select('question_key,target_id').eq('session_id', id).eq('voter_id', user.id),
          supabase.rpc('can_manage_match_teams', { p_session_id: id }),
        ])
        const nextMatch = check('match', matchResult)
        const roster = check('players', rosterResult)
        const savedRound = check('round', roundResult)
        const savedVotes = check('votes', voteResult)
        const canManage = check('permissions', managerResult)
        setMatch(nextMatch)
        setCanManageTeams(Boolean(canManage))
        setPlayers((roster ?? []).filter(row => row.profiles).map(row => ({ id: row.player_id, name: (row.profiles as { display_name: string }).display_name })).sort((a, b) => a.name.localeCompare(b.name)))
        const nextRound = savedRound ?? { predictions_closed: false, motm_open: false, motm_closed: false }
        setRound(nextRound)
        setVotes(Object.fromEntries((savedVotes ?? []).map(vote => [vote.question_key, vote.target_id])))
        if (canManage || (roster ?? []).some(row => row.player_id === user.id)) {
          const result = await supabase.rpc('get_vestiaire_results', { p_session_id: id })
          setResults(check('results', result) ?? [])
        } else setResults([])
      }
      setError('')
    } catch (issue) {
      console.error('Locker Room could not be loaded:', issue)
      const detail = issue instanceof Error ? issue.message : String(issue)
      setError(`${fr ? 'Impossible de charger le Vestiaire' : 'Could not load the Locker Room'}: ${detail}`)
    } finally { setLoading(false) }
  }

  useEffect(() => {
    setLoading(true)
    setMatch(null)
    setPredictionsFinished(false)
    void refresh()
    const onFocus = () => { if (document.visibilityState === 'visible') void refresh() }
    const interval = window.setInterval(onFocus, 15000)
    window.addEventListener('focus', onFocus)
    return () => { window.clearInterval(interval); window.removeEventListener('focus', onFocus) }
  }, [id, user?.id, language])

  const castVote = async (key: string, targetId: string) => {
    if (!id || busy) return
    setBusy(true); setError('')
    const { error: issue } = await supabase.rpc('cast_vestiaire_vote', { p_session_id: id, p_question_key: key, p_target_id: targetId })
    if (issue) setError(fr ? 'Vote non enregistré. Actualisez le match et réessayez.' : 'Vote not saved. Refresh the match and try again.')
    else { setVotes(previous => ({ ...previous, [key]: targetId })); await Promise.all([refresh(), refreshNotifications()]) }
    setBusy(false)
  }

  const advance = async (action: string) => {
    if (!id || busy) return
    setBusy(true); setError('')
    const { error: issue } = await supabase.rpc('advance_vestiaire_round', { p_session_id: id, p_action: action })
    if (issue) setError(fr ? 'Impossible de passer à l’étape suivante.' : 'Could not move to the next step.')
    else { setConfirmAction(null); await Promise.all([refresh(), refreshNotifications()]) }
    setBusy(false)
  }

  const title = fr ? 'Le Vestiaire' : 'The Locker Room'
  const activeMatches = matches.filter(item => !item.round?.motm_closed)
  const historyMatches = matches.filter(item => item.round?.motm_closed).sort((a, b) => (b.round?.updated_at ?? '').localeCompare(a.round?.updated_at ?? ''))
  const visibleMatches = (listView === 'history' ? historyMatches : activeMatches).filter(item => item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase().trim()))
  if (loading) return <div className="empty-state"><div className="loading-ring" /><p>{fr ? 'On prépare le Vestiaire...' : 'Getting the Locker Room ready...'}</p></div>

  if (!id) return <div className="page-stack vestiaire-page">
    <div className="page-heading"><div><p className="overline">GO&DEV</p><h1>{title}</h1><p>{fr ? 'Pronostics avant le match, verdicts après.' : 'Predictions before kickoff, results after.'}</p></div></div>
    <div className="vestiaire-intro"><span>01</span><p>{fr ? 'Avant le match : votez pour vos six pronostics.' : 'Before the game: cast your six predictions.'}</p><span>02</span><p>{fr ? 'Après le match : élisez le Man of the Match.' : 'After the game: choose your Man of the Match.'}</p></div>
    <div className="vestiaire-history-toolbar"><div className="filter-tabs" role="group" aria-label={fr ? 'Afficher les matchs' : 'Match view'}><button className={listView === 'active' ? 'selected' : ''} aria-pressed={listView === 'active'} onClick={() => setParams({ view: 'active' })}>{fr ? 'En cours' : 'Active'} <span className="count-bubble">{activeMatches.length}</span></button><button className={listView === 'history' ? 'selected' : ''} aria-pressed={listView === 'history'} onClick={() => setParams({ view: 'history' })}>{fr ? 'Historique' : 'History'} <span className="count-bubble">{historyMatches.length}</span></button></div><label className="search-box"><Icon name="search" size={16} /><input value={search} onChange={event => setSearch(event.target.value)} aria-label={fr ? 'Rechercher un match du Vestiaire' : 'Search Locker Room matches'} placeholder={fr ? 'Rechercher un match…' : 'Find a match…'} /></label></div>
    {listView === 'history' && <p className="field-hint">{fr ? 'Les votes terminés restent ici. Ouvrez un match pour retrouver le Man of the Match et les pronostics.' : 'Completed votes stay here. Open a match to revisit Man of the Match and prediction results.'}</p>}
    {error && <p className="form-error" role="alert">{error} <button onClick={() => void refresh()}>{fr ? 'Réessayer' : 'Retry'}</button></p>}
    {visibleMatches.length ? <div className="vestiaire-match-list">{visibleMatches.map(item => <Link to={'/vestiaire/' + item.id + (listView === 'history' ? '?from=history' : '')} className="club-panel vestiaire-match" key={item.id}>
      <span className="overline">{(listView === 'history' ? item.round?.updated_at : item.scheduled_at) ? new Date((listView === 'history' ? item.round!.updated_at : item.scheduled_at)!).toLocaleString(language) : fr ? 'Match à venir' : 'Upcoming match'}</span>
      <strong>{item.name}</strong>
      <small className="vestiaire-history-phase">{item.round?.motm_closed ? fr ? 'Votes terminés · Résultats disponibles' : 'Voting finished · Results available' : item.round?.motm_open ? fr ? 'Après-match · Votes ouverts' : 'Post-match · Voting open' : item.round?.predictions_closed ? fr ? 'En attente du match' : 'Waiting for the game' : fr ? 'Avant-match · Pronostics ouverts' : 'Before kickoff · Predictions open'}</small>
      <span>{listView === 'history' ? fr ? 'Revoir les résultats' : 'Revisit results' : fr ? 'Entrer au Vestiaire' : 'Enter the Locker Room'} <Icon name="arrow" size={16} /></span>
    </Link>)}</div> : <div className="empty-state"><h2>{search ? fr ? 'Aucun match trouvé' : 'No matching matches' : listView === 'history' ? fr ? 'Pas encore d’historique' : 'No history yet' : fr ? 'Aucun vote en cours' : 'No active voting'}</h2><p>{search ? fr ? 'Essayez un autre nom.' : 'Try another name.' : listView === 'history' ? fr ? 'Les matchs apparaîtront ici une fois le vote clôturé.' : 'Matches appear here once voting is closed.' : fr ? 'Rejoignez un match pour participer aux pronostics.' : 'Join a match to take part in predictions.'}</p>{!search && listView === 'active' && <Link to="/matches" className="primary-button">{fr ? 'Voir les matchs' : 'Browse matches'}</Link>}</div>}
  </div>

  if (!match || match.cancelled_at) return <div className="empty-state"><h1>{fr ? 'Match indisponible' : 'Match unavailable'}</h1>{error && <p className="form-error" role="alert">{error} <button onClick={() => void refresh()}>{fr ? 'Réessayer' : 'Retry'}</button></p>}<Link to="/vestiaire" className="secondary-button">{title}</Link></div>
  // The same management controls serve the organizer and designated super admins.
  const organizer = canManageTeams
  const joined = players.some(player => player.id === user?.id)
  if (!joined && !organizer) return <div className="page-stack vestiaire-page"><Link to={params.get('from') === 'history' ? '/vestiaire?view=history' : '/vestiaire'} className="back-link"><Icon name="back" size={16} />{title}</Link><div className="empty-state"><h1>{fr ? 'Rejoignez le match pour entrer au Vestiaire.' : 'Join the match to enter the Locker Room.'}</h1><p>{fr ? 'Les pronostics sont réservés aux joueurs de ce match.' : 'Predictions are for players in this match.'}</p><Link to={'/session/' + id} className="primary-button">{fr ? 'Ouvrir le match' : 'Open match'}</Link></div></div>
  const availablePlayers = players.filter(player => player.id !== user?.id)
  const phase = round.motm_closed ? 'results' : round.motm_open ? 'motm' : round.predictions_closed ? 'waiting' : 'predictions'
  const question = predictionQuestions[questionIndex]
  const currentKey = phase === 'motm' ? 'motm' : question.key
  const motmResults = results.find(result => result.question_key === 'motm')
  const savedPredictionCount = predictionQuestions.filter(item => Boolean(votes[item.key])).length

  return <div className="page-stack vestiaire-page">
    <Link to={params.get('from') === 'history' ? '/vestiaire?view=history' : '/vestiaire'} className="back-link"><Icon name="back" size={16} />{title}</Link>
    <div className="page-heading"><div><p className="overline">{title.toUpperCase()}</p><h1>{match.name}</h1><p>{fr ? 'Vos votes restent privés. Les classements évoluent avec les nouveaux votes.' : 'Your votes stay private. Rankings update as others vote.'}</p></div><span className="standalone-status">{phase === 'predictions' ? fr ? 'Avant-match' : 'Before kickoff' : phase === 'motm' ? 'Man of the Match' : phase === 'results' ? fr ? 'Résultats' : 'Results' : fr ? 'En attente du match' : 'Waiting for the game'}</span></div>
    {error && <p className="form-error" role="alert">{error} <button onClick={() => void refresh()}>{fr ? 'Actualiser' : 'Refresh'}</button></p>}
    {phase === 'predictions' && (predictionsFinished ? <section className="club-panel vestiaire-vote-panel"><span className="overline">{fr ? 'PRONOSTICS TERMINÉS' : 'PREDICTIONS COMPLETE'}</span><h2>{fr ? 'Vos six votes sont enregistrés.' : 'All six votes are saved.'}</h2><p>{fr ? 'Vous pouvez les modifier tant que les pronostics restent ouverts.' : 'You can change them while predictions are open.'}</p><div className="button-row"><Link to="/vestiaire" className="primary-button">{fr ? 'Retour au Vestiaire' : 'Back to the Locker Room'}</Link><button type="button" className="secondary-button" onClick={() => setPredictionsFinished(false)}>{fr ? 'Modifier mes votes' : 'Edit my votes'}</button></div></section> : <section className="club-panel vestiaire-vote-panel"><span className="overline">{fr ? 'PRONOSTIC' : 'PREDICTION'} {questionIndex + 1} / {predictionQuestions.length}</span><h2>{fr ? question.darija : question.english}</h2><p>{fr ? 'Choisissez un joueur. Vous pouvez changer votre vote tant que les pronostics sont ouverts.' : 'Pick a player. You can change your vote while predictions are open.'}</p>{joined ? availablePlayers.length ? <div className="vestiaire-player-grid">{availablePlayers.map(player => <button key={player.id} type="button" className={'vestiaire-player-choice ' + (votes[currentKey] === player.id ? 'selected' : '')} aria-pressed={votes[currentKey] === player.id} disabled={busy} onClick={() => void castVote(currentKey, player.id)}><Avatar name={player.name} size="sm" /><span>{player.name}</span>{votes[currentKey] === player.id && <Icon name="check" size={17} />}</button>)}</div> : <p>{fr ? 'Il faut au moins deux joueurs pour voter.' : 'At least two players are needed to vote.'}</p> : <p className="vestiaire-join-note">{fr ? 'Rejoignez ce match pour voter.' : 'Join this match to vote.'} <Link to={'/session/' + id}>{fr ? 'Ouvrir le match' : 'Open match'}</Link></p>}<div className="vestiaire-pager"><button type="button" className="secondary-button" disabled={questionIndex === 0} onClick={() => setQuestionIndex(index => index - 1)}>{fr ? 'Précédent' : 'Previous'}</button><span>{savedPredictionCount} / 6 {fr ? 'votes enregistrés' : 'votes saved'}</span>{questionIndex === predictionQuestions.length - 1 ? <button type="button" className="primary-button" disabled={busy || savedPredictionCount !== predictionQuestions.length} onClick={() => setPredictionsFinished(true)}>{fr ? 'Terminer' : 'Done'}</button> : <button type="button" className="secondary-button" onClick={() => setQuestionIndex(index => index + 1)}>{fr ? 'Suivant' : 'Next'}</button>}</div></section>)}
    {phase === 'waiting' && <div className="empty-state"><h2>{fr ? 'Les pronostics sont enregistrés.' : 'Predictions are locked in.'}</h2><p>{fr ? 'Après le match, l’organisateur ouvrira le vote Man of the Match.' : 'After the game, the organizer will open Man of the Match voting.'}</p></div>}
    {round.motm_open && <TeamFeedback matchId={match.id} joined={joined} canManage={canManageTeams} />}
    {phase === 'motm' && <section className="club-panel vestiaire-vote-panel"><span className="overline">APRÈS-MATCH</span><h2>Man of the Match</h2><p>{fr ? 'Qui a vraiment marqué ce match ? Choisissez un joueur. Seul le gagnant sera annoncé.' : 'Who really owned this game? Choose one player. Only the winner will be announced.'}</p>{joined ? <div className="vestiaire-player-grid">{availablePlayers.map(player => <button key={player.id} type="button" className={'vestiaire-player-choice ' + (votes.motm === player.id ? 'selected' : '')} aria-pressed={votes.motm === player.id} disabled={busy} onClick={() => void castVote('motm', player.id)}><Avatar name={player.name} size="sm" /><span>{player.name}</span>{votes.motm === player.id && <Icon name="check" size={17} />}</button>)}</div> : <p className="vestiaire-join-note">{fr ? 'Seuls les joueurs du match peuvent voter.' : 'Only players in this match can vote.'}</p>}</section>}
    {(phase === 'results' || savedPredictionCount === predictionQuestions.length || organizer || (round.motm_open && Boolean(votes.motm))) && <div className="vestiaire-results">
      {(phase === 'results' || (round.motm_open && (Boolean(votes.motm) || organizer))) && <section className="club-panel vestiaire-winner"><span className="overline">MAN OF THE MATCH · {round.motm_closed ? fr ? 'RÉSULTAT FINAL' : 'FINAL RESULT' : fr ? 'EN DIRECT' : 'LIVE'}</span><h2>{motmResults?.display_name ?? (fr ? 'Aucun vote' : 'No votes')}</h2></section>}
      {(round.motm_closed || savedPredictionCount === predictionQuestions.length || organizer) && <section><div className="vestiaire-results-heading"><h2>{fr ? 'Le top 3 des pronostics' : 'Prediction top threes'}</h2><span>{round.predictions_closed ? fr ? 'Résultats définitifs' : 'Final results' : fr ? 'Mis à jour avec les nouveaux votes' : 'Updates as votes come in'}</span></div><div className="vestiaire-result-grid">{predictionQuestions.map(item => <section className="club-panel vestiaire-result-card" key={item.key}><span className="overline">TOP 3</span><h3>{fr ? item.darija : item.english}</h3>{results.filter(result => result.question_key === item.key).length ? <ol>{results.filter(result => result.question_key === item.key).map(result => <li key={result.player_id}><span>{String(result.place).padStart(2, '0')}</span><strong>{result.display_name}</strong></li>)}</ol> : <p>{fr ? 'Aucun vote' : 'No votes'}</p>}</section>)}</div></section>}
    </div>}
    {organizer && phase !== 'results' && <section className="club-panel vestiaire-organizer"><div><span className="overline">{fr ? 'GESTION DU MATCH' : 'MATCH MANAGEMENT'}</span><h2>{fr ? 'Gérer les votes' : 'Manage voting'}</h2><p>{phase === 'predictions' ? fr ? 'Fermez les pronostics au coup d’envoi.' : 'Close predictions at kickoff.' : phase === 'waiting' ? fr ? 'Ouvrez le vote après le match.' : 'Open voting after the game.' : fr ? 'Clôturez le vote pour figer les résultats et déplacer le match dans l’historique.' : 'Close voting to freeze the results and move the match into history.'}</p></div>{confirmAction ? <div className="button-row"><button type="button" className="primary-button" disabled={busy} onClick={() => void advance(confirmAction)}>{fr ? 'Confirmer' : 'Confirm'}</button><button type="button" className="secondary-button" onClick={() => setConfirmAction(null)}>{fr ? 'Annuler' : 'Cancel'}</button></div> : <button type="button" className="primary-button" onClick={() => setConfirmAction(phase === 'predictions' ? 'close_predictions' : phase === 'waiting' ? 'open_motm' : 'close_motm')}>{phase === 'predictions' ? fr ? 'Fermer les pronostics' : 'Close predictions' : phase === 'waiting' ? fr ? 'Ouvrir Man of the Match' : 'Open Man of the Match' : fr ? 'Clôturer le vote' : 'Close voting'}</button>}</section>}
  </div>
}
