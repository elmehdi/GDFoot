import { useI18n } from '../context/LanguageContext'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Avatar from '../components/Avatar'
import Icon from '../components/Icon'
import MatchProgress from '../components/MatchProgress'
import { positionLabels } from '../lib/positions'
import MatchVenue from '../components/MatchVenue'
import type { Profile, Session, PlayerPosition } from '../lib/database.types'

export default function SessionDetail() {
  const { t } = useI18n()

  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [match, setMatch] = useState<Session | null>(null)
  const [players, setPlayers] = useState<(Profile & { position: PlayerPosition })[]>([])
  const [voters, setVoters] = useState(0)
  const [rated, setRated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [editName, setEditName] = useState('')
  const [editSize, setEditSize] = useState<5 | 6 | 8 | 11 | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const joined = players.some(player => player.id === user?.id)
  const organizer = match?.created_by === user?.id
  const needed = Math.max(0, (match?.team_size ?? 5) * 2 - players.length)
  const fetchMatch = async () => {
    if (!id || !user) return
    try {
      const [sessionResult, rosterResult] = await Promise.all([
        supabase.from('sessions').select('*').eq('id', id).single(),
        supabase.from('session_players').select('position, profiles(id, display_name, avatar_url, created_at)').eq('session_id', id),
      ])
      if (sessionResult.error || rosterResult.error) throw sessionResult.error || rosterResult.error
      setMatch(sessionResult.data)
      setPlayers((rosterResult.data ?? []).filter(row => row.profiles).map(row => ({ ...(row.profiles as unknown as Profile), position: row.position ?? 'any' })).filter(Boolean))
      if (sessionResult.data.status === 'voting') {
        const [progress, myVotes] = await Promise.all([supabase.rpc('get_vote_progress', { p_session_id: id }), supabase.from('votes').select('target_id').eq('session_id', id).eq('voter_id', user.id)])
        if (typeof progress.data === 'number') setVoters(progress.data)
        setRated((myVotes.data?.length ?? 0) >= Math.max(1, (rosterResult.data?.length ?? 0) - 1))
      }
    } catch { setError(t("Could not load this match. Please refresh and try again.")) }
    finally { setLoading(false) }
  }
  useEffect(() => {
    void fetchMatch()
    const refresh = () => { if (document.visibilityState === 'visible') void fetchMatch() }
    const interval = window.setInterval(refresh, 15000)
    window.addEventListener('focus', refresh)
    return () => { clearInterval(interval); window.removeEventListener('focus', refresh) }
  }, [id, user?.id])
  const run = async (operation: () => Promise<void>) => {
    if (busy) return
    setBusy(true); setError('')
    try { await operation() }
    catch (issue) { setError(issue instanceof Error ? issue.message : t("That action could not be completed. Please try again.")) }
    finally { setBusy(false) }
  }
  const join = () => run(async () => {
    if (!id || !user) return
    const { error: issue } = await supabase.from('session_players').insert({ session_id: id, player_id: user.id })
    if (issue && issue.code !== '23505') throw new Error(t("Could not join the match. Please try again."))
    await fetchMatch()
  })
  const setPosition = (playerId: string, position: PlayerPosition) => run(async () => {
    const { error: issue } = await supabase.rpc('set_player_position', { p_session_id: id!, p_player_id: playerId, p_position: position })
    if (issue) throw new Error(t("Could not save the position. Please try again or contact the organizer."))
    setPlayers(previous => previous.map(player => player.id === playerId ? { ...player, position } : player))
  })
  const invite = async () => {
    setShowInvite(true)
    try { await navigator.clipboard.writeText(window.location.origin + '/session/' + id); setCopied(true) }
    catch { setCopied(false) }
  }
  const startRatings = () => run(async () => {
    if (!id) return
    const { error: issue } = await supabase.from('sessions').update({ status: 'voting' }).eq('id', id)
    if (issue) throw new Error(t("Could not start ratings. Please try again."))
    await fetchMatch()
  })
  const generate = (existing = false) => run(async () => {
    if (!id) return
    const { error: issue } = await supabase.rpc(existing || match?.league_id ? 'generate_teams_from_ratings' : 'generate_teams', { p_session_id: id })
    if (issue) throw new Error(t("Could not balance the teams. Please try again."))
    navigate('/results/' + id)
  })
  if (loading) return <div className="empty-state"><div className="loading-ring" /><p>{t("Getting the squad together...")}</p></div>
  if (!match) return <div className="empty-state"><h1>{t("Match unavailable")}</h1><p>{error || t("This match could not be found.")}</p><Link to="/matches" className="primary-button">{t("Back to matches")}</Link></div>
  const completed = match.status === 'completed'
  const voting = match.status === 'voting'
  const currentStep = completed ? match.locked ? 3 : 2 : voting ? 1 : 0
  const title = completed ? t("Your lineup is ready.") : voting ? !joined ? t("Player ratings are underway.") : rated ? t("You’re all caught up.") : t("Help make the sides fair.") : !joined ? t("There’s a game with your name on it.") : needed ? t("You’re in. Let’s fill the squad.") : organizer ? t("Everyone’s in. Time to balance.") : t("The squad is ready.")
  const instruction = completed ? t("See who you’re playing with and check your team color.") : voting ? !joined ? t("The player list is closed for ratings. You can view the teams when the organizer generates them.") : rated ? organizer ? t("Your ratings are saved. Generate the teams when you’re ready.") : t("Your ratings are saved. The organizer will generate your teams next.") : t("Rate the players you’ll be playing with. Your individual ratings stay private.") : !joined ? t("Join the player list first. The organizer will generate balanced teams once everyone is ready.") : needed ? t('{count} more players needed for {size}v{size}. Copy the link and invite your friends.', { count: needed, size: match.team_size }) : organizer ? t("Start a rating round so everyone can help balance the teams.") : t("The organizer will open player ratings next. Your match updates automatically.")
  return <div className="page-stack">
    <Link to={match.league_id ? '/league/' + match.league_id : '/matches'} className="back-link"><Icon name="back" size={16} />{match.league_id ? t("Back to league") : t("Back to matches")}</Link>
    <div className="page-heading"><div><p className="overline">{organizer ? t("YOU’RE ORGANIZING") : joined ? t("YOUR MATCH") : t("MATCH INVITATION")}</p><h1>{match.name}</h1><p>{match.team_size} vs {match.team_size} <span className="inline-divider">/</span> {players.length}  {t("players joined")}</p></div><span className="standalone-status"><span className="live-dot" />{completed ? t("Teams ready") : voting ? t("Player ratings") : t("Building the squad")}</span></div>
    <MatchVenue matchId={match.id} stadiumId={match.stadium_id} canEdit={organizer} onSaved={stadiumId => setMatch(previous => previous ? { ...previous, stadium_id: stadiumId } : null)} />
    <MatchProgress current={currentStep} />
    {(location.state as { created?: boolean } | null)?.created && <div className="success-note"><Icon name="check" />{t("Match created. Invite your friends using the link below.")}</div>}
    {error && <div role="alert" className="form-error">{error}<button className="text-link" onClick={() => { setError(''); void fetchMatch() }}>{t("Refresh match")}</button></div>}
    <div className="match-room-layout">
      <section id="match-players" className="club-panel roster-panel"><div className="section-heading"><div><span className="overline">{t("WHO’S PLAYING")}</span><h2>{t("The player list")} <span className="count-bubble">{players.length}</span></h2></div><Icon name="teams" size={24} /></div><p className="roster-explainer">{completed ? t("The organizer has generated teams. Open the lineup to see your side.") : t("Join this list first. Teams are assigned using skill ratings, so everyone gets a fair game.")}</p><p className="field-hint">{organizer && !completed ? t("Assign positions before generating. Flexible players can fill any role. Roles and skill both count when balancing.") : t("Tap a player name to view or edit your private rating.")}</p><div className="roster-list">{players.map((player, index) => <div key={player.id} className={'roster-player ' + (player.id === user?.id ? 'is-you' : '')}><span className="roster-number">{String(index + 1).padStart(2, '0')}</span><Avatar name={player.display_name} /><div><Link className="player-name-link" to={'/ratings?player=' + player.id}>{player.display_name}</Link><small>{player.id === match.created_by ? t("Organizer") : t("Player")}</small></div>{organizer && !completed ? <select className="position-select" aria-label={t("Position: ") + player.display_name} value={player.position} disabled={busy} onChange={event => setPosition(player.id, event.target.value as PlayerPosition)}>{Object.entries(positionLabels).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select> : <span className="position-label">{t(positionLabels[player.position])}</span>}{player.id === user?.id ? <span className="you-badge">{t("YOU")}</span> : <Icon name="check" size={16} />}</div>)}{!completed && !voting && Array.from({ length: Math.min(needed, 3) }, (_, index) => <div key={'empty-' + index} className="roster-player empty-slot"><span className="roster-number">{String(players.length + index + 1).padStart(2, '0')}</span><span className="empty-avatar"><Icon name="plus" size={18} /></span><span>{t("Spot waiting for a teammate")}</span></div>)}</div>{needed > 3 && !voting && !completed && <p className="field-hint">{t("And")} {needed - 3}  {t("more spots to fill.")}</p>}</section>
      <aside className="match-room-aside"><section className="action-panel"><span className="overline">{completed ? t("NEXT: MEET YOUR TEAM") : t("HERE’S WHAT TO DO")}</span><h2>{title}</h2><p>{instruction}</p>{organizer && !completed && <a className="position-shortcut" href="#match-players"><Icon name="shirt" size={20} /><span><strong>{t('Assign player positions')}</strong><small>{t('{count} positions assigned. Optional before balancing.', { count: players.filter(player => player.position !== 'any').length })}</small></span><Icon name="arrow" size={16} /></a>}{!completed && <div className="attendance"><div><span>{voting ? t("Ratings submitted") : t("Players joined")}</span><strong>{voting ? voters : players.length} / {voting ? players.length : match.team_size * 2}</strong></div><div className="attendance-track"><span style={{ width: Math.min(100, (voting ? voters / Math.max(1, players.length) : players.length / (match.team_size * 2)) * 100) + '%' }} /></div></div>}
        {completed ? <Link className="primary-button full-width" to={'/results/' + id}>{t("See my team")} <Icon name="arrow" /></Link> : !joined && !voting ? <button className="primary-button full-width" disabled={busy} onClick={join}>{busy ? t("Joining...") : t("Join this match")}<Icon name="plus" /></button> : voting && joined ? <><Link className={rated ? 'secondary-button full-width' : 'primary-button full-width'} to={'/vote/' + id}>{rated ? t("Review my ratings") : t("Rate the players")}<Icon name="arrow" /></Link>{organizer && <button className={rated ? 'primary-button full-width' : 'secondary-button full-width'} disabled={busy} onClick={() => generate()}>{busy ? t("Balancing teams...") : t("Generate balanced teams")}<Icon name="teams" /></button>}{organizer && voters < players.length && <small>{t("You can generate now, or wait for everyone’s ratings.")}</small>}</> : joined && !voting ? <>{organizer && !needed ? <button className="primary-button full-width" disabled={busy} onClick={startRatings}>{t("Start player ratings")}<Icon name="arrow" /></button> : <button className="primary-button full-width" onClick={invite}>{t("Invite friends")}<Icon name="link" /></button>}{organizer && needed > 0 && <p className="field-hint">{t("Start ratings becomes available when")} {match.team_size * 2}  {t("players have joined.")}</p>}{!needed && <button className="secondary-button full-width" onClick={invite}>{t("Copy match link")}<Icon name="link" /></button>}</> : <Link to="/matches?filter=open" className="primary-button full-width">{t("Find an open match")}<Icon name="arrow" /></Link>}
        {showInvite && <div className="invite-box"><label htmlFor="invite-url">{copied ? t("Copied! Paste this in your group chat.") : t("Copy this link and send it to your friends.")}</label><input id="invite-url" readOnly value={window.location.origin + '/session/' + id} onFocus={event => event.target.select()} /><p role="status">{t("Friends sign in, then tap “Join this match.”")}</p></div>}
      </section><div className="info-note"><Icon name="shirt" /><p><strong>{t("How do I choose my team?")}</strong><br />{t("You join the match, then the organizer generates balanced sides using player ratings. Your team appears on the lineup screen.")}</p></div>
      {organizer && !completed && !voting && players.length >= match.team_size * 2 && <details className="club-details"><summary>{t("Already have player ratings?")}</summary><p>{t("Use saved ratings to generate teams without a new voting round. Unrated players receive the default skill rating.")}</p><button className="secondary-button full-width" disabled={busy} onClick={() => generate(true)}>{t("Use saved ratings")}</button></details>}
      {!organizer && joined && match.status === 'open' && <button className="quiet-button" disabled={busy} onClick={() => run(async () => { const { error: issue } = await supabase.from('session_players').delete().eq('session_id', id!).eq('player_id', user!.id); if (issue) throw new Error(t("Could not leave the match.")); await fetchMatch() })}>{t("Leave this match")}</button>}
      </aside>
    </div>
    {organizer && match.status === 'open' && <details className="club-details"><summary>{t("Match settings")}</summary><div className="settings-content"><label htmlFor="rename-match">{t("Rename match")}</label><input id="rename-match" placeholder={match.name} value={editName} onChange={event => setEditName(event.target.value)} className="input-field" /><label htmlFor="edit-format">{t("Players per team")}</label><select id="edit-format" className="input-field" value={editSize ?? match.team_size} onChange={event => setEditSize(Number(event.target.value) as 5 | 6 | 8 | 11)}>{[5, 6, 8, 11].map(size => <option key={size} value={size}>{size} vs {size}</option>)}</select><button className="secondary-button" disabled={busy || (!editName.trim() && editSize === null)} onClick={() => run(async () => { const { error: issue } = await supabase.from('sessions').update({ name: editName.trim() || match.name, team_size: editSize ?? match.team_size }).eq('id', id!); if (issue) throw new Error(t("Could not rename this match.")); setEditName(''); setEditSize(null); await fetchMatch() })}>{t("Save changes")}</button><button className="quiet-button danger" onClick={() => setDeleteConfirm(true)}>{t("Delete match")}</button>{deleteConfirm && <div className="form-error"><p>{t("Delete this match and its player list? This cannot be undone.")}</p><div className="button-row"><button disabled={busy} onClick={() => run(async () => { const { error: issue } = await supabase.from('sessions').delete().eq('id', id!); if (issue) throw new Error(t("Could not delete this match.")); navigate('/matches') })}>{t("Yes, delete match")}</button><button onClick={() => setDeleteConfirm(false)}>{t("Keep match")}</button></div></div>}</div></details>}
  </div>
}
