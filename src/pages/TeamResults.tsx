import { useI18n } from '../context/LanguageContext'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toPng } from 'html-to-image'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { positionLabels } from '../lib/positions'
import type { Session, PlayerPosition } from '../lib/database.types'
import Avatar from '../components/Avatar'
import Icon from '../components/Icon'
import MatchProgress from '../components/MatchProgress'
import MatchVenue from '../components/MatchVenue'
import { useClubDirectory } from '../context/ClubDirectoryContext'

type Member = { position: PlayerPosition; player_id: string; team: number; profiles: { display_name: string } | null }
const palette = [{ name: 'Blue', color: '#94b8ff' }, { name: 'Red', color: '#f4a09b' }, { name: 'Green', color: '#8fd3ac' }, { name: 'Purple', color: '#c2a5f2' }, { name: 'Gold', color: '#e5cc8c' }, { name: 'Pink', color: '#eab1d4' }]
export default function TeamResults() {
  const { t } = useI18n()

  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { stadiumName } = useClubDirectory()
  const [match, setMatch] = useState<Session | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [score, setScore] = useState<{ team_1_goals: number; team_2_goals: number } | null>(null)
  const [goals, setGoals] = useState([0, 0])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [downloaded, setDownloaded] = useState(false)
  const board = useRef<HTMLDivElement>(null)
  const fetchData = async () => {
    if (!id) return
    try {
      const [sessionResult, playersResult, scoreResult] = await Promise.all([
        supabase.from('sessions').select('*').eq('id', id).single(),
        supabase.from('session_players').select('player_id, team, position, profiles(display_name)').eq('session_id', id).not('team', 'is', null).order('team'),
        supabase.from('match_results').select('team_1_goals, team_2_goals').eq('session_id', id).maybeSingle(),
      ])
      if (sessionResult.error || playersResult.error || scoreResult.error) throw sessionResult.error || playersResult.error || scoreResult.error
      setMatch(sessionResult.data)
      setMembers((playersResult.data ?? []) as unknown as Member[])
      setScore(scoreResult.data)
      if (scoreResult.data) setGoals([scoreResult.data.team_1_goals, scoreResult.data.team_2_goals])
    } catch { setError(t("Could not load the lineup. Please refresh and try again.")) }
    finally { setLoading(false) }
  }
  useEffect(() => { void fetchData() }, [id, user?.id])
  const run = async (operation: () => Promise<void>) => {
    if (busy) return
    setBusy(true); setError('')
    try { await operation() }
    catch (issue) { setError(issue instanceof Error ? issue.message : t("That action could not be completed. Please try again.")) }
    finally { setBusy(false) }
  }
  const download = () => run(async () => {
    if (!board.current) return
    const url = await toPng(board.current, { backgroundColor: '#171e14', pixelRatio: 2 })
    const link = document.createElement('a'); link.download = (match?.name || 'lineup') + '.png'; link.href = url; link.click(); setDownloaded(true)
  })
  const confirm = () => run(async () => {
    const { error: issue } = await supabase.from('sessions').update({ locked: true }).eq('id', id!)
    if (issue) throw new Error(t("Could not confirm the teams. Try again."))
    setMatch(previous => previous ? { ...previous, locked: true } : null)
  })
  const rebalance = () => run(async () => {
    const { error: issue } = await supabase.rpc(match?.rating_source === 'global' ? 'generate_teams_from_ratings' : 'generate_teams', { p_session_id: id! })
    if (issue) throw new Error(t("Could not rebalance the teams. Try again."))
    await fetchData()
  })
  const recordScore = () => run(async () => {
    const result = { team_1_goals: goals[0], team_2_goals: goals[1] }
    const { error: issue } = await supabase.from('match_results').upsert({ ...result, session_id: id!, recorded_by: user!.id }, { onConflict: 'session_id' })
    if (issue) throw new Error(t("Could not record the score. Please try again."))
    setScore(result)
  })
  const teamNumbers = [...new Set(members.filter(member => member.team > 0).map(member => member.team))].sort((a, b) => a - b)
  const bench = members.filter(member => member.team === 0)
  const myTeam = members.find(member => member.player_id === user?.id)?.team
  const colorFor = (team: number) => {
    const squad = match?.league_id ? (team === 1 ? match.home_squad : match.away_squad) : null
    if (squad) return palette[(squad - 1) % palette.length]
    if (team === 3) return { name: t("Yellow"), color: '#e5cc8c' }
    return palette[(team - 1) % palette.length]
  }
  if (loading) return <div className="empty-state"><div className="loading-ring" /><p>{t("Finding your team...")}</p></div>
  if (!match) return <div className="empty-state"><h1>{t("Lineup unavailable")}</h1><p>{error}</p><Link to="/matches" className="primary-button">{t("Back to matches")}</Link></div>
  const organizer = match.created_by === user?.id
  const hasTeams = teamNumbers.length > 0
  return <div className="page-stack"><Link to={match.league_id ? '/league/' + match.league_id : '/session/' + id} className="back-link"><Icon name="back" size={16} />{match.league_id ? t("Back to league") : t("Back to match")}</Link><div className="page-heading"><div><span className="overline">{match.locked ? t("THE LINEUP IS SET") : t("REVIEW THE SIDES")}</span><h1>{match.name}</h1><p>{hasTeams ? match.locked ? t("Find your color. Meet your teammates. Get ready to play.") : t("These are the proposed teams. The organizer confirms the final lineup.") : t("Teams have not been generated yet.")}</p></div>{match.locked && hasTeams && <button className="primary-button" disabled={busy} onClick={download}>{t("Download lineup")}<Icon name="arrow" /></button>}</div><MatchVenue matchId={match.id} stadiumId={match.stadium_id} canEdit={organizer} onSaved={stadiumId => setMatch(previous => previous ? { ...previous, stadium_id: stadiumId } : null)} /><MatchProgress current={match.locked ? 3 : 2} />
    {error && <div className="form-error" role="alert">{error}</div>}{downloaded && <div className="success-note" role="status"><Icon name="check" />{t("Lineup downloaded. Share the image with your squad.")}</div>}
    {myTeam !== undefined && <div className="your-team-banner"><Icon name="shirt" size={38} style={{ color: myTeam > 0 ? colorFor(myTeam).color : '#bbc6aa' }} /><div><span className="overline">{t("YOUR ASSIGNMENT")}</span><h2>{myTeam === 0 ? t("You’re on the bench.") : t('You’re on the {color} team.', { color: t(colorFor(myTeam).name) })}</h2><p>{myTeam === 0 ? t("Check with the organizer about rotating into the game.") : match.locked ? t("Your teammates are listed below. Look for the highlighted card.") : t("This is your proposed side until the organizer confirms.")}</p></div></div>}
    {!hasTeams ? <div className="empty-state"><Icon name="teams" size={32} /><h3>{t("The sides aren’t set yet.")}</h3><p>{t("Return to the match to check player and rating progress.")}</p><Link className="primary-button" to={'/session/' + id}>{t("Back to match")}</Link></div> : <div ref={board} className="result-board"><div className="result-board-heading"><span>{t("G&D / MATCHDAY LINEUP")}</span><strong>{match.name}</strong><span>{match.locked ? t("CONFIRMED") : t("PROPOSED TEAMS")}</span></div><p className="venue-label lineup-venue"><Icon name="pin" size={16} />{stadiumName(match.stadium_id)}</p><div className="result-teams">{teamNumbers.map(team => { const color = colorFor(team); const roster = members.filter(member => member.team === team); return <section key={team} className={'result-team ' + (myTeam === team ? 'your-side' : '')}><header style={{ borderColor: color.color }}><Icon name="shirt" size={38} style={{ color: color.color }} /><div><span>{t("TEAM")} {String(team).padStart(2, '0')}</span><h2 style={{ color: color.color }}>{t(color.name)}</h2></div><div className="team-meta">{myTeam === team && <span className="you-badge">{t("YOUR TEAM")}</span>}<small>{roster.length}  {t("players")}</small></div></header><div>{roster.map((member, index) => <div key={member.player_id} className={'result-player ' + (member.player_id === user?.id ? 'is-you' : '')}><span>{String(index + 1).padStart(2, '0')}</span><Avatar name={member.profiles?.display_name ?? t("Player")} size="sm" /><Link className="player-name-link" to={'/ratings?player=' + member.player_id}>{member.profiles?.display_name ?? t("Player")}<small className="lineup-position">{t(positionLabels[member.position ?? 'any'])}</small></Link>{member.player_id === user?.id && <span className="you-badge">{t("YOU")}</span>}</div>)}</div></section> })}</div>{bench.length > 0 && <div className="bench-row"><span>{t("BENCH")}</span>{bench.map(member => <Link className="player-name-link" to={"/ratings?player=" + member.player_id} key={member.player_id}>{member.profiles?.display_name ?? t("Player")}{member.player_id === user?.id ? ' ' + t('(you)') : ''}</Link>)}</div>}<div className="result-board-footer">{match.league_id ? t("Fixed league squads") : t("Teams generated from skill ratings")}<span>{t("BETTER SIDES. BETTER GAMES.")}</span></div></div>}
    {hasTeams && !match.locked && <section className="club-panel result-confirm"><div><h2>{organizer ? t("Happy with the lineup?") : t("Waiting for the organizer")}</h2><p>{organizer ? t("Confirm the teams to finalize the sides and share the lineup.") : t("Your assignment will be final once the organizer confirms the teams.")}</p></div>{organizer ? <div className="button-row">{!match.league_id && <button disabled={busy} className="secondary-button" onClick={rebalance}><Icon name="refresh" size={16} />{t("Rebalance")}</button>}<button disabled={busy} className="primary-button" onClick={confirm}>{busy ? t("Please wait...") : t("Confirm these teams")}<Icon name="check" /></button></div> : <button className="secondary-button" onClick={fetchData}>{t("Refresh lineup")}<Icon name="refresh" size={16} /></button>}</section>}
    {match.locked && teamNumbers.length === 2 && (organizer || score) && <section className="club-panel score-panel"><span className="overline">{score ? t("FULL TIME") : t("AFTER THE FINAL WHISTLE")}</span><h2>{score ? t("The final score") : t("How did the game finish?")}</h2><div className="score-inputs">{teamNumbers.map((team, index) => <label key={team} style={{ color: colorFor(team).color }}><span>{t(colorFor(team).name)}</span>{score ? <strong>{index === 0 ? score.team_1_goals : score.team_2_goals}</strong> : <input aria-label={t('{color} goals', { color: t(colorFor(team).name) })} type="number" min={0} max={99} step={1} value={goals[index]} onChange={event => setGoals(previous => previous.map((value, i) => i === index ? Math.max(0, Math.min(99, Math.floor(Number(event.target.value) || 0))) : value))} />}</label>)}</div>{!score && <button className="primary-button" onClick={recordScore} disabled={busy}>{busy ? t("Saving score...") : t("Save final score")}</button>}</section>}
  </div>
}
