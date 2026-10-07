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
import MatchMembershipActions from '../components/MatchMembershipActions'
import TeamBadge from '../components/TeamBadge'
import { useClubDirectory } from '../context/ClubDirectoryContext'

type Member = { position: PlayerPosition; player_id: string; team: number; profiles: { display_name: string } | null }
type PickupGame = { id: string; game_number: number; team_a: number; team_b: number; goals_a: number; goals_b: number; ended_by: 'time' | 'two_goals' }
const palette = [{ name: 'Blue', color: '#94b8ff' }, { name: 'Red', color: '#f4a09b' }, { name: 'Green', color: '#8fd3ac' }, { name: 'Purple', color: '#c2a5f2' }, { name: 'Gold', color: '#e5cc8c' }, { name: 'Pink', color: '#eab1d4' }]
export default function TeamResults() {
  const { t } = useI18n()

  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { stadiumName } = useClubDirectory()
  const [match, setMatch] = useState<Session | null>(null)
  const [canManageTeams, setCanManageTeams] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [joined, setJoined] = useState(false)
  const [score, setScore] = useState<{ team_1_goals: number; team_2_goals: number } | null>(null)
  const [games, setGames] = useState<PickupGame[]>([])
  const [gamesError, setGamesError] = useState('')
  const [scoreError, setScoreError] = useState('')
  const [editingGameId, setEditingGameId] = useState<string | null>(null)
  const [gameTeams, setGameTeams] = useState([1, 2])
  const [gameGoals, setGameGoals] = useState([0, 0])
  const [goals, setGoals] = useState([0, 0])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [downloaded, setDownloaded] = useState(false)
  const [shareImage, setShareImage] = useState<{ url: string; file: File } | null>(null)
  const board = useRef<HTMLDivElement>(null)
  const fetchData = async () => {
    if (!id) return
    setLoading(true); setError(''); setGamesError(''); setScoreError('')
    try {
      const [sessionResult, playersResult, managerResult] = await Promise.all([
        supabase.from('sessions').select('*').eq('id', id).single(),
        supabase.from('session_players').select('player_id, team, position, profiles(display_name)').eq('session_id', id).order('team'),
        supabase.rpc('can_manage_match_teams', { p_session_id: id }),
      ])
      if (sessionResult.error || playersResult.error) throw sessionResult.error || playersResult.error
      setMatch(sessionResult.data)
      setCanManageTeams(!managerResult.error && Boolean(managerResult.data))
      if (managerResult.error) setError(t('Team management is unavailable. You can still view the lineup.'))
      setJoined((playersResult.data ?? []).some(player => player.player_id === user?.id))
      setMembers((playersResult.data ?? []).filter(player => player.team !== null) as unknown as Member[])
      // Score history is optional; it must never hide a successfully loaded lineup.
      let nextGames: PickupGame[] = []
      setScore(null)
      if (sessionResult.data.locked && !sessionResult.data.cancelled_at) {
        if (sessionResult.data.league_id) {
          const scoreResult = await supabase.from('match_results').select('team_1_goals, team_2_goals').eq('session_id', id).maybeSingle()
          if (scoreResult.error) setScoreError(t('The score could not be loaded. The lineup is still available.'))
          else {
            setScore(scoreResult.data)
            if (scoreResult.data) setGoals([scoreResult.data.team_1_goals, scoreResult.data.team_2_goals])
          }
        } else {
          const gamesResult = await supabase.from('session_games').select('id,game_number,team_a,team_b,goals_a,goals_b,ended_by').eq('session_id', id).order('game_number')
          if (gamesResult.error) setGamesError(t('Game scores are unavailable. The lineup is still available.'))
          else nextGames = (gamesResult.data ?? []) as PickupGame[]
        }
      }
      setGames(nextGames)
      const availableTeams = [...new Set((playersResult.data ?? []).map(player => player.team).filter((team): team is number => typeof team === 'number' && team > 0))].sort((a, b) => a - b)
      const latest = nextGames[nextGames.length - 1]
      const winner = latest && latest.goals_a !== latest.goals_b ? latest.goals_a > latest.goals_b ? latest.team_a : latest.team_b : null
      const waiting = latest && availableTeams.find(team => team !== latest.team_a && team !== latest.team_b)
      setGameTeams(winner && waiting ? [winner, waiting] : availableTeams.slice(0, 2))
      setGameGoals([0, 0])
    } catch { setMatch(null); setError(t("Could not load the lineup. Please refresh and try again.")) }
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
    const url = await toPng(board.current, { backgroundColor: getComputedStyle(board.current).backgroundColor, pixelRatio: 2, filter: node => !(node instanceof HTMLElement && node.classList.contains('lineup-position')) })
    const link = document.createElement('a'); link.download = (match?.name || 'lineup') + '.png'; link.href = url; link.click(); setDownloaded(true)
  })
  const prepareShare = () => run(async () => {
    if (!board.current) return
    const url = await toPng(board.current, { backgroundColor: getComputedStyle(board.current).backgroundColor, pixelRatio: 2, filter: node => !(node instanceof HTMLElement && node.classList.contains('lineup-position')) })
    const blob = await (await fetch(url)).blob()
    setShareImage({ url, file: new File([blob], 'GoDev-lineup.png', { type: 'image/png' }) })
  })
  const share = async () => {
    if (!shareImage || busy) return
    setBusy(true); setError('')
    try {
      await navigator.share({ files: [shareImage.file], title: match?.name || 'Go&Dev' })
      setShareImage(null)
    } catch (issue) {
      if (!(issue instanceof DOMException && issue.name === 'AbortError')) setError(t('Sharing failed. Save the image and attach it in your app.'))
    } finally { setBusy(false) }
  }
  const confirm = () => run(async () => {
    const { error: issue } = await supabase.rpc('confirm_match_teams', { p_session_id: id! })
    if (issue) throw new Error(t("Could not confirm the teams. Try again."))
    await fetchData()
  })
  const join = () => run(async () => {
    if (!match || !user || match.cancelled_at || match.home_squad !== null) return
    const { error: issue } = await supabase.from('session_players').insert({ session_id: match.id, player_id: user.id, team: match.status === 'completed' ? 0 : null })
    if (issue && issue.code !== '23505') throw new Error(t('Could not join the match. Please try again.'))
    setJoined(true)
    await fetchData()
  })
  const leave = () => run(async () => {
    if (!match || !user || match.locked || match.cancelled_at || match.home_squad !== null) return
    const { error: issue } = await supabase.from('session_players').delete().eq('session_id', match.id).eq('player_id', user.id)
    if (issue) throw new Error(t('Could not leave the match.'))
    setJoined(false)
    setMembers(previous => previous.filter(member => member.player_id !== user.id))
    await fetchData()
  })
  const editSetup = () => run(async () => {
    const { error: issue } = await supabase.rpc('reopen_match_for_edits', { p_session_id: id! })
    if (issue) throw new Error(t('Could not return to team setup.'))
    window.location.assign('/session/' + id)
  })
  const rebalance = () => run(async () => {
    const { error: issue } = await supabase.rpc('generate_teams_from_ratings', { p_session_id: id! })
    if (issue) throw new Error(t(issue.message.includes('SEPARATION_NO_SOLUTION') ? 'These player separations cannot fit into full teams. The current lineup has been kept.' : issue.message.includes('SEPARATION_SEARCH_LIMIT') ? 'There are too many combinations to check. The current lineup has been kept.' : 'Could not rebalance the teams. Try again.'))
    await fetchData()
  })
  const recordScore = () => run(async () => {
    const result = { team_1_goals: goals[0], team_2_goals: goals[1] }
    const { error: issue } = await supabase.from('match_results').upsert({ ...result, session_id: id!, recorded_by: user!.id }, { onConflict: 'session_id' })
    if (issue) throw new Error(t("Could not record the score. Please try again."))
    setScore(result)
  })
  const recordGame = () => run(async () => {
    if (!id || gameTeams[0] === gameTeams[1]) throw new Error(t('Choose two different teams.'))
    if (gameGoals[0] === 2 && gameGoals[1] === 2) throw new Error(t('A game stops when one team reaches two goals.'))
    const { error: issue } = await supabase.rpc('save_session_game', {
      p_session_id: id, p_game_id: editingGameId,
      p_team_a: gameTeams[0], p_team_b: gameTeams[1],
      p_goals_a: gameGoals[0], p_goals_b: gameGoals[1],
      p_ended_by: gameGoals.includes(2) ? 'two_goals' : 'time',
    })
    if (issue) throw new Error(issue.message)
    setEditingGameId(null)
    await fetchData()
  })
  const teamNumbers = [...new Set(members.filter(member => member.team > 0).map(member => member.team))].sort((a, b) => a - b)
  const bench = members.filter(member => member.team === 0)
  const myTeam = members.find(member => member.player_id === user?.id)?.team
  const teamLabel = (team: number) => t('Team {number}', { number: (match?.league_id ? (team === 1 ? match.home_squad : match.away_squad) : null) ?? team })
  const badgeNumberFor = (team: number) => (match?.league_id ? (team === 1 ? match.home_squad : match.away_squad) : null) ?? team
  const colorFor = (team: number) => {
    const squad = match?.league_id ? (team === 1 ? match.home_squad : match.away_squad) : null
    if (squad) return palette[(squad - 1) % palette.length]
    if (team === 3) return { name: t("Yellow"), color: '#e5cc8c' }
    return palette[(team - 1) % palette.length]
  }
  if (loading) return <div className="empty-state"><div className="loading-ring" /><p>{t("Finding your team...")}</p></div>
  if (!match) return <div className="empty-state"><h1>{t("Lineup unavailable")}</h1><p>{error}</p><button className="secondary-button" onClick={() => void fetchData()}>{t('Try again')}</button><Link to="/matches" className="primary-button">{t("Back to matches")}</Link></div>
  if (match.cancelled_at) return <div className="empty-state"><h1>{t('Match cancelled')}</h1><p>{match.name}</p><Link to={'/session/' + id}>{t('Back to match')}</Link></div>
  const organizer = match.created_by === user?.id
  const hasTeams = teamNumbers.length > 0
  return <div className="page-stack"><Link to={match.league_id ? '/league/' + match.league_id : '/session/' + id} className="back-link"><Icon name="back" size={16} />{match.league_id ? t("Back to league") : t("Back to match")}</Link><div className="page-heading"><div><span className="overline">{match.locked ? t("THE LINEUP IS SET") : t("REVIEW THE SIDES")}</span><h1>{match.name}</h1><p>{hasTeams ? match.locked ? t("Find your team. Meet your teammates. Get ready to play.") : t("These are the proposed teams. The organizer confirms the final lineup.") : t("Teams have not been generated yet.")}</p></div>{hasTeams && <div className="button-row"><button className="secondary-button" disabled={busy} onClick={download}>{t("Save image")}<Icon name="arrow" /></button><button className="primary-button" disabled={busy} onClick={prepareShare}>{busy ? t("Please wait...") : t("Share lineup")}<Icon name="link" /></button></div>}</div><MatchVenue matchId={match.id} stadiumId={match.stadium_id} canEdit={organizer} onSaved={stadiumId => setMatch(previous => previous ? { ...previous, stadium_id: stadiumId } : null)} /><MatchProgress current={match.locked ? 2 : 1} />
    {error && <div className="form-error" role="alert">{error}</div>}{downloaded && <div className="success-note" role="status"><Icon name="check" />{t("Lineup downloaded. Share the image with your squad.")}</div>}
    {(gamesError || scoreError) && <div className="form-error" role="alert">{gamesError || scoreError} <button className="text-link" onClick={() => void fetchData()}>{t('Try again')}</button></div>}
    <MatchMembershipActions match={match} joined={joined} disabled={busy} onJoin={join} onLeave={leave} />
    {myTeam !== undefined && <div className="your-team-banner">{myTeam > 0 ? <TeamBadge team={badgeNumberFor(myTeam)} color={colorFor(myTeam).color} size={64} /> : <Icon name="teams" size={38} style={{ color: '#bbc6aa' }} />}<div><span className="overline">{t("YOUR ASSIGNMENT")}</span><h2>{myTeam === 0 ? t("You’re on the bench.") : t('Your team: {team}', { team: teamLabel(myTeam) })}</h2><p>{myTeam === 0 ? t("Check with the organizer about rotating into the game.") : match.locked ? t("Your teammates are listed below. Look for the highlighted card.") : t("This is your proposed side until the organizer confirms.")}</p></div></div>}
    {!hasTeams ? <div className="empty-state"><Icon name="teams" size={32} /><h3>{t("The sides aren’t set yet.")}</h3><p>{t("Return to the match to check player and rating progress.")}</p><Link className="primary-button" to={'/session/' + id}>{t("Back to match")}</Link></div> : <div ref={board} className="result-board"><div className="result-board-heading"><span>{t("G&D / MATCHDAY LINEUP")}</span><strong>{match.name}</strong><span>{match.locked ? t("CONFIRMED") : t("PROPOSED TEAMS")}</span></div><p className="venue-label lineup-venue"><Icon name="pin" size={16} />{stadiumName(match.stadium_id)}</p><div className="result-teams">{teamNumbers.map(team => { const color = colorFor(team); const roster = members.filter(member => member.team === team); return <section key={team} className={'result-team ' + (myTeam === team ? 'your-side' : '')}><header style={{ borderColor: color.color }}><TeamBadge team={badgeNumberFor(team)} color={color.color} /><div><h2 style={{ color: color.color }}>{teamLabel(team)}</h2></div><div className="team-meta">{myTeam === team && <span className="you-badge">{t("YOUR TEAM")}</span>}<small>{roster.length}  {t("players")}</small></div></header><div>{roster.map((member, index) => <div key={member.player_id} className={'result-player ' + (member.player_id === user?.id ? 'is-you' : '')}><span>{String(index + 1).padStart(2, '0')}</span><Avatar name={member.profiles?.display_name ?? t("Player")} size="sm" /><Link className="player-name-link" to={'/ratings?player=' + member.player_id}>{member.profiles?.display_name ?? t("Player")}{canManageTeams && <small className="lineup-position">{t(positionLabels[member.position ?? 'any'])}</small>}</Link>{member.player_id === user?.id && <span className="you-badge">{t("YOU")}</span>}</div>)}</div></section> })}</div>{bench.length > 0 && <div className="bench-row"><span>{t("BENCH")}</span>{bench.map(member => <Link className="player-name-link" to={"/ratings?player=" + member.player_id} key={member.player_id}>{member.profiles?.display_name ?? t("Player")}{member.player_id === user?.id ? ' ' + t('(you)') : ''}</Link>)}</div>}<div className="result-board-footer">{match.league_id ? t("Fixed league squads") : t("Teams generated from skill ratings")}<span>{t("BETTER SIDES. BETTER GAMES.")}</span></div></div>}
    {hasTeams && !match.locked && <section className="club-panel result-confirm"><div><h2>{canManageTeams ? t("Happy with the lineup?") : t("Waiting for the organizer")}</h2><p>{canManageTeams ? t("You can share this proposed lineup now. Confirm it when the teams are final.") : t("Your assignment will be final once the organizer confirms the teams.")}</p></div>{canManageTeams ? <div className="button-row"><button disabled={busy} className="secondary-button" onClick={editSetup}>{t("Back to player setup")}<Icon name="back" size={16} /></button>{!match.league_id && <button disabled={busy} className="secondary-button" onClick={rebalance}><Icon name="refresh" size={16} />{t("Rebalance")}</button>}<button disabled={busy} className="primary-button" onClick={confirm}>{busy ? t("Please wait...") : t("Confirm these teams")}<Icon name="check" /></button></div> : <button className="secondary-button" onClick={fetchData}>{t("Refresh lineup")}<Icon name="refresh" size={16} /></button>}</section>}
    {match.locked && !match.league_id && !gamesError && teamNumbers.length >= 2 && <section className="club-panel pickup-games-panel"><span className="overline">{t('SHORT GAMES')}</span><h2>{t('Game by game')}</h2><p>{t('Each game lasts up to 10 minutes or ends when a team reaches two goals. The losing team rotates out; choose the next two teams for every game.')}</p>{games.length ? <ol className="pickup-game-list">{games.map(game => <li key={game.id}><span className="pickup-game-number">{t('Game {number}', { number: game.game_number })}</span><strong>{teamLabel(game.team_a)} <b>{game.goals_a}–{game.goals_b}</b> {teamLabel(game.team_b)}</strong><small>{game.ended_by === 'two_goals' ? t('Two-goal limit') : t('10-minute limit')}</small>{organizer && <button type="button" className="text-link" disabled={busy} onClick={() => { setEditingGameId(game.id); setGameTeams([game.team_a, game.team_b]); setGameGoals([game.goals_a, game.goals_b]) }}>{t('Edit score')}</button>}</li>)}</ol> : <p className="pickup-no-games">{t('No games recorded yet.')}</p>}{organizer && <div className="pickup-game-editor"><h3>{editingGameId ? t('Edit game score') : t('Record the next game')}</h3><div className="pickup-game-fields">{([0, 1] as const).map(index => <label key={index}><span>{t('Team {number}', { number: index + 1 })}</span><select className="input-field" value={gameTeams[index] ?? ''} onChange={event => setGameTeams(previous => previous.map((team, i) => i === index ? Number(event.target.value) : team))}>{teamNumbers.map(team => <option key={team} value={team}>{teamLabel(team)}</option>)}</select><span>{t('Goals')}</span><input className="input-field" type="number" min={0} max={2} value={gameGoals[index]} onChange={event => setGameGoals(previous => previous.map((goal, i) => i === index ? Math.max(0, Math.min(2, Math.floor(Number(event.target.value) || 0))) : goal))} /></label>)}</div><p className="field-hint">{gameGoals.includes(2) ? t('Ends when a team reaches two goals.') : t('Ends after 10 minutes.')}</p><div className="button-row"><button type="button" className="primary-button" disabled={busy || gameTeams.length < 2 || gameTeams[0] === gameTeams[1] || gameGoals[0] === 2 && gameGoals[1] === 2} onClick={recordGame}>{busy ? t('Saving score...') : editingGameId ? t('Save changes') : t('Save game')}</button>{editingGameId && <button type="button" className="secondary-button" onClick={() => { setEditingGameId(null); setGameGoals([0, 0]); setGameTeams(teamNumbers.slice(0, 2)) }}>{t('Cancel')}</button>}</div></div>}</section>}
    {match.locked && !!match.league_id && !scoreError && teamNumbers.length === 2 && (organizer || score) && <section className="club-panel score-panel"><span className="overline">{score ? t("FULL TIME") : t("AFTER THE FINAL WHISTLE")}</span><h2>{score ? t("The final score") : t("How did the game finish?")}</h2><div className="score-inputs">{teamNumbers.map((team, index) => <label key={team} style={{ color: colorFor(team).color }}><span>{teamLabel(team)}</span>{score ? <strong>{index === 0 ? score.team_1_goals : score.team_2_goals}</strong> : <input aria-label={t('{color} goals', { color: teamLabel(team) })} type="number" min={0} max={99} step={1} value={goals[index]} onChange={event => setGoals(previous => previous.map((value, i) => i === index ? Math.max(0, Math.min(99, Math.floor(Number(event.target.value) || 0))) : value))} />}</label>)}</div>{!score && <button className="primary-button" onClick={recordScore} disabled={busy}>{busy ? t("Saving score...") : t("Save final score")}</button>}</section>}
    {shareImage && <div className="modal-backdrop" onKeyDown={event => { if (event.key === 'Escape' && !busy) setShareImage(null) }}><section className="club-panel lineup-share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-title"><h2 id="share-title">{t('Share lineup')}</h2><p>{t('Choose WhatsApp, Instagram or another available app. You can also save the image and attach it yourself.')}</p><img src={shareImage.url} alt={t('Team lineup preview')} /><div className="button-row">{navigator.canShare?.({ files: [shareImage.file] }) && <button autoFocus className="primary-button" disabled={busy} onClick={share}>{t('Choose an app')}<Icon name="link" /></button>}<a className="secondary-button" href={shareImage.url} download="GoDev-lineup.png">{t('Save image')}</a><button className="quiet-button" disabled={busy} onClick={() => setShareImage(null)}>{t('Close')}</button></div>{error && <p role="alert" className="form-error">{error}</p>}</section></div>}
  </div>
}

