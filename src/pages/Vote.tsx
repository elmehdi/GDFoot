import { useI18n } from '../context/LanguageContext'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Profile } from '../lib/database.types'
import Avatar from '../components/Avatar'
import Icon from '../components/Icon'
import MatchProgress from '../components/MatchProgress'
import SkillRatingFields from '../components/SkillRatingFields'
import { emptySkills, type SkillRatings } from '../lib/playerSkills'

export default function Vote() {
  const { t } = useI18n()

  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [players, setPlayers] = useState<Profile[]>([])
  const [scores, setScores] = useState<Record<string, number>>({})
  const [skills, setSkills] = useState<Record<string, SkillRatings>>({})
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [allowed, setAllowed] = useState(false)
  const fetchPlayers = async () => {
    if (!id || !user) return
    setLoading(true); setError('')
    try {
      const [match, roster, votes, skillVotes] = await Promise.all([
        supabase.from('sessions').select('status').eq('id', id).single(),
        supabase.from('session_players').select('player_id, profiles(id, display_name, avatar_url, created_at)').eq('session_id', id),
        supabase.from('votes').select('target_id, score').eq('session_id', id).eq('voter_id', user.id),
        supabase.from('player_skill_ratings').select('*').eq('voter_id', user.id),
      ])
      if (match.error || roster.error || votes.error || skillVotes.error) throw new Error(t("Could not load the player list. Please try again."))
      const canVote = match.data.status === 'voting' && roster.data.some(row => row.player_id === user.id)
      setAllowed(canVote)
      if (!canVote) return
      const targets = roster.data.filter(row => row.player_id !== user.id).map(row => row.profiles as unknown as Profile).filter(Boolean)
      const existing = Object.fromEntries(votes.data.map(vote => [vote.target_id, vote.score]))
      setPlayers(targets); setScores(existing); setSkills(Object.fromEntries((skillVotes.data ?? []).map(row => [row.target_id, row])))
      setIndex(Math.max(0, targets.findIndex(player => existing[player.id] === undefined)))
    } catch (issue) { setError(issue instanceof Error ? issue.message : t("Could not load ratings.")) }
    finally { setLoading(false) }
  }
  useEffect(() => { void fetchPlayers() }, [id, user?.id])
  const submit = async () => {
    if (!id || !user || busy || players.some(player => scores[player.id] === undefined)) return
    setBusy(true); setError('')
    try {
      const { error: issue } = await supabase.rpc('save_match_card_votes', { p_session_id: id, p_votes: players.map(player => ({ target_id: player.id, score: scores[player.id], skills: skills[player.id] ?? emptySkills() })) })
      if (issue) throw issue
      navigate('/session/' + id, { state: { voted: true } })
    } catch { setError(t("Ratings could not be saved. Your selections are still here; please try again.")) }
    finally { setBusy(false) }
  }
  if (loading) return <div className="empty-state"><div className="loading-ring" /><p>{t("Loading your teammates...")}</p></div>
  if (!allowed || !players.length) return <div className="empty-state"><Icon name="star" size={36} /><h1>{error ? t("Ratings unavailable") : t("No ratings to submit right now.")}</h1><p>{error || t("Ratings open after you join the match and the organizer starts the rating round.")}</p>{error && <button className="secondary-button" onClick={fetchPlayers}>{t("Try again")}</button>}<Link className="primary-button" to={'/session/' + id}>{t("Back to match")}</Link></div>
  const player = players[index]
  const selected = scores[player.id]
  const ratedCount = players.filter(target => scores[target.id] !== undefined).length
  const allRated = ratedCount === players.length
  return <div className="page-stack rating-page"><Link to={'/session/' + id} className="back-link"><Icon name="back" size={16} />  {t("Back to match")}</Link><div className="page-heading"><div><span className="overline">{t("FAIR RATINGS. FAIR TEAMS.")}</span><h1>{t("Know your teammates.")}</h1><p>{t("Rate their overall football ability. Individual ratings stay private.")}</p></div><span className="standalone-status">{ratedCount}  {t("of")} {players.length}  {t("rated")}</span></div><MatchProgress current={1} /><div className="rating-layout"><section className="club-panel rating-card"><div className="section-heading"><span className="overline">{t("PLAYER")} {String(index + 1).padStart(2, '0')} / {String(players.length).padStart(2, '0')}</span><span className="muted text-xs">{selected !== undefined ? t("Rating selected") : t("Not rated yet")}</span></div><div className="rating-player"><Avatar name={player.display_name} size="xl" /><h2>{player.display_name}</h2><p>{t("How would you rate their overall level?")}</p></div><div className="rating-score">{selected ?? '—'}<span>/ 10</span></div><div className="rating-scale">{Array.from({ length: 10 }, (_, number) => number + 1).map(number => <button key={number} aria-label={t('{score} out of 10 for {name}', { score: number, name: player.display_name })} aria-pressed={selected === number} className={selected === number ? 'selected' : ''} onClick={() => setScores(previous => ({ ...previous, [player.id]: number }))}>{number}</button>)}</div><SkillRatingFields value={skills[player.id] ?? emptySkills()} disabled={busy} onChange={value => setSkills(previous => ({ ...previous, [player.id]: value }))} />{error && <p role="alert" className="form-error">{error}</p>}<div className="setup-actions"><button className="secondary-button" disabled={index === 0 || busy} onClick={() => setIndex(previous => previous - 1)}>{t("Previous")}</button>{index < players.length - 1 ? <button className="primary-button" disabled={selected === undefined} onClick={() => setIndex(previous => previous + 1)}>{t("Next player")}<Icon name="arrow" size={18} /></button> : <button className="primary-button" disabled={!allRated || busy} onClick={submit}>{busy ? t("Saving ratings...") : t("Submit all ratings")}<Icon name="check" size={18} /></button>}</div>{index === players.length - 1 && !allRated && <p className="field-hint">{t("Choose the remaining players in the list to finish your ratings.")}</p>}</section><aside className="club-panel rating-roster"><span className="overline">{t("YOUR PROGRESS")}</span><h2>{t("The squad")}</h2><p>{t("Tap a player to review their rating.")}</p>{players.map((target, targetIndex) => <button key={target.id} className={targetIndex === index ? 'active' : ''} onClick={() => setIndex(targetIndex)}><Avatar name={target.display_name} size="sm" /><span>{target.display_name}</span>{scores[target.id] !== undefined ? <b>{scores[target.id]}</b> : <small>{t("To rate")}</small>}</button>)}<div className="info-note"><Icon name="star" size={18} /><p>{t("Rate skill, not friendship. Honest ratings help make close games.")}</p></div></aside></div></div>
}
