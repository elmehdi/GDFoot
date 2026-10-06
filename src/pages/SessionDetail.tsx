import { useRatingReminders } from '../context/RatingRemindersContext'
import MatchSeparations from '../components/MatchSeparations'
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
  const { pending } = useRatingReminders()
  const navigate = useNavigate()
  const location = useLocation()
  const [match, setMatch] = useState<Session | null>(null)
  const [canManageTeams, setCanManageTeams] = useState(false)
  const [players, setPlayers] = useState<(Profile & { position: PlayerPosition })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [separationPending, setSeparationPending] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [editName, setEditName] = useState('')
  const [editSize, setEditSize] = useState<5 | 6 | 8 | 11 | null>(null)
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const missingRatings = pending.filter(player => players.some(member => member.id === player.player_id))
  const joined = players.some(player => player.id === user?.id)
  const organizer = match?.created_by === user?.id
  const needed = Math.max(0, (match?.team_size ?? 5) * 2 - players.length)
  const fetchMatch = async () => {
    if (!id || !user) return
    try {
      const [sessionResult, rosterResult, managerResult] = await Promise.all([
        supabase.from('sessions').select('*').eq('id', id).single(),
        supabase.from('session_players').select('position, profiles(id, display_name, avatar_url, created_at)').eq('session_id', id),
        supabase.rpc('can_manage_match_teams', { p_session_id: id }),
      ])
      if (sessionResult.error || rosterResult.error || managerResult.error) throw sessionResult.error || rosterResult.error || managerResult.error
      setMatch(sessionResult.data)
      setCanManageTeams(Boolean(managerResult.data))
      setPlayers((rosterResult.data ?? []).filter(row => row.profiles).map(row => ({ ...(row.profiles as unknown as Profile), position: row.position ?? 'any' })).filter(Boolean))

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
    if (busy || separationPending) return
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
    if ((location.state as { joinFailed?: boolean } | null)?.joinFailed) navigate(location.pathname, { replace: true, state: null })
  })
  const leave = () => run(async () => {
    if (!id || !user) return
    const { error: issue } = await supabase.from('session_players').delete().eq('session_id', id).eq('player_id', user.id)
    if (issue) throw new Error(t('Could not leave the match.'))
    await fetchMatch()
  })
  const setPosition = (playerId: string, position: PlayerPosition) => run(async () => {
    const { error: issue } = await supabase.rpc('set_player_position', { p_session_id: id!, p_player_id: playerId, p_position: position })
    if (issue) throw new Error(t("Could not save the position. Please try again."))
    setPlayers(previous => previous.map(player => player.id === playerId ? { ...player, position } : player))
  })
  const invite = async () => {
    setShowInvite(true)
    try { await navigator.clipboard.writeText(window.location.origin + '/session/' + id); setCopied(true) }
    catch { setCopied(false) }
  }
  const generate = () => run(async () => {
    if (!id) return
    const { error: issue } = await supabase.rpc('generate_teams_from_ratings', { p_session_id: id })
    if (issue) throw new Error(t(issue.message.includes('SEPARATION_NO_SOLUTION') ? 'These player separations cannot fit into full teams. Remove a group or change the match format, then try again.' : issue.message.includes('SEPARATION_SEARCH_LIMIT') ? 'There are too many combinations to check. Simplify the player separations and try again.' : 'Could not balance the teams. Please try again.'))
    navigate('/results/' + id)
  })
  if (loading) return <div className="empty-state"><div className="loading-ring" /><p>{t("Getting the squad together...")}</p></div>
  if (!match) return <div className="empty-state"><h1>{t("Match unavailable")}</h1><p>{error || t("This match could not be found.")}</p><Link to="/matches" className="primary-button">{t("Back to matches")}</Link></div>
  if (match.cancelled_at) return <div className="empty-state"><h1>{t('Match cancelled')}</h1><h2>{match.name}</h2><p>{t('The organizer cancelled this match. All joined players have been notified.')}</p><Link className="primary-button" to="/matches">{t('Back to matches')}</Link></div>
  const completed = match.status === 'completed'
  const currentStep = completed ? match.locked ? 2 : 1 : 0
  const title = completed ? t('Your lineup is ready.') : organizer ? t('Your match is ready to organize.') : canManageTeams ? t('Team setup is ready.') : !joined ? t('Join this match') : t('You are in. Nothing else to confirm.')
  const instruction = completed ? t('See your team on the lineup screen.') : canManageTeams ? t('Set positions, then generate teams using saved ratings.') : t('The organizer will generate your team using saved ratings. Only missing player ratings need your attention.')
  return <div className="page-stack">
    <Link to={match.league_id ? '/league/' + match.league_id : '/matches'} className="back-link"><Icon name="back" size={16} />{match.league_id ? t("Back to league") : t("Back to matches")}</Link>
    <div className="page-heading"><div><p className="overline">{organizer ? t("YOU’RE ORGANIZING") : joined ? t("YOUR MATCH") : t("MATCH INVITATION")}</p><h1>{match.name}</h1><p>{match.team_size} vs {match.team_size} <span className="inline-divider">/</span> {players.length}  {t("players joined")}</p></div><span className="standalone-status"><span className="live-dot" />{completed ? t("Teams ready") : t("Building the squad")}</span></div>
    {match.scheduled_at && <p>{t("Match date and time")}: {new Date(match.scheduled_at).toLocaleString()}</p>}
    <MatchVenue matchId={match.id} stadiumId={match.stadium_id} canEdit={organizer} onSaved={stadiumId => setMatch(previous => previous ? { ...previous, stadium_id: stadiumId } : null)} />
    <Link to={'/vestiaire/' + match.id} className="vestiaire-match-link"><Icon name="locker" size={18} /><span><strong>{t('Locker Room')}</strong><small>{t('Predictions before kickoff, results after.')}</small></span><Icon name="arrow" size={17} /></Link>
    <MatchProgress current={currentStep} />
    {(location.state as { created?: boolean } | null)?.created && <div className="success-note"><Icon name="check" />{t("Match created. Invite your friends using the link below.")}</div>}
    {(location.state as { joinFailed?: boolean } | null)?.joinFailed && <div role="alert" className="form-error">{t('Your match was created, but your player registration failed. Try joining again.')} <button className="text-link" disabled={busy} onClick={join}>{t('Join as a player')}</button></div>}
    {error && <div role="alert" className="form-error">{error}<button className="text-link" onClick={() => { setError(''); void fetchMatch() }}>{t("Refresh match")}</button></div>}
    <div className="match-room-layout">
      <section id="match-players" className="club-panel roster-panel"><div className="section-heading"><div><span className="overline">{t("WHO’S PLAYING")}</span><h2>{t("The player list")} <span className="count-bubble">{players.length}</span></h2></div><Icon name="teams" size={24} /></div><p className="roster-explainer">{completed ? t("The organizer has generated teams. Open the lineup to see your side.") : canManageTeams ? t('Assign positions before generating teams.') : t("Join this list first. Teams are assigned using skill ratings, so everyone gets a fair game.")}</p><p className="field-hint">{canManageTeams && !completed ? t("Assign positions before generating. Flexible players can fill any role. Roles and skill both count when balancing.") : t("Tap a player name to view or edit your private rating.")}</p><div className="roster-list">{players.map((player, index) => <div key={player.id} className={'roster-player ' + (canManageTeams ? 'has-position ' : '') + (player.id === user?.id ? 'is-you' : '')}><span className="roster-number">{String(index + 1).padStart(2, '0')}</span><Avatar name={player.display_name} /><div className="roster-identity"><Link className="player-name-link" to={'/ratings?player=' + player.id}>{player.display_name}</Link><small>{player.id === match.created_by ? t("Organizer") : t("Player")}</small></div>{canManageTeams && !completed ? <select className="position-select" aria-label={t("Position: ") + player.display_name} value={player.position} disabled={busy || separationPending} onChange={event => setPosition(player.id, event.target.value as PlayerPosition)}>{Object.entries(positionLabels).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select> : canManageTeams ? <span className="position-label">{t(positionLabels[player.position])}</span> : null}{player.id === user?.id ? <span className="you-badge">{t("YOU")}</span> : <Icon name="check" size={16} />}</div>)}{!completed && Array.from({ length: Math.min(needed, 3) }, (_, index) => <div key={'empty-' + index} className="roster-player empty-slot"><span className="roster-number">{String(players.length + index + 1).padStart(2, '0')}</span><span className="empty-avatar"><Icon name="plus" size={18} /></span><span>{t("Spot waiting for a teammate")}</span></div>)}</div>{needed > 3 && !completed && <p className="field-hint">{t("And")} {needed - 3}  {t("more spots to fill.")}</p>}{organizer && !completed && <MatchSeparations matchId={match.id} players={players} disabled={busy} onPendingChange={setSeparationPending} />}</section>
      <aside className="match-room-aside"><section className="action-panel"><span className="overline">{completed ? t("NEXT: MEET YOUR TEAM") : t("HERE’S WHAT TO DO")}</span><h2>{title}</h2><p>{instruction}</p>{organizer && !completed && <a className="text-link separation-shortcut" href="#match-separations" onClick={() => { const panel = document.getElementById("match-separations"); if (panel instanceof HTMLDetailsElement) panel.open = true }}>{t("Keep players on different teams")}<Icon name="arrow" size={16} /></a>}{canManageTeams && !completed && <a className="position-shortcut" href="#match-players"><Icon name="shirt" size={20} /><span><strong>{t('Assign player positions')}</strong><small>{t('{count} positions assigned. Optional before balancing.', { count: players.filter(player => player.position !== 'any').length })}</small></span><Icon name="arrow" size={16} /></a>}{!completed && <div className="attendance"><div><span>{t('Players joined')}</span><strong>{players.length} {t("players joined")}</strong></div><div className="attendance-track"><span style={{ width: Math.min(100, players.length / (match.team_size * 2) * 100) + '%' }} /></div></div>}
        {completed ? <Link className="primary-button full-width" to={'/results/' + id}>{t('See the teams')}<Icon name="arrow" /></Link> : canManageTeams ? <>
          <button className="primary-button full-width" disabled={busy || separationPending || needed > 0} onClick={generate}>{busy ? t('Balancing teams...') : t('Generate balanced teams')}<Icon name="teams" /></button>
          {needed > 0 ? <p className="field-hint">{t('{count} more for the first two teams', { count: needed })}</p> : <p className="field-hint">{t('{teams} full teams and {subs} substitutes possible. More players can still join.', { teams: Math.floor(players.length / match.team_size), subs: players.length % match.team_size })}</p>}
          <button className="secondary-button full-width" onClick={invite}>{t('Copy match link')}<Icon name="link" /></button>
          <button type="button" className={joined ? "secondary-button full-width match-leave-button" : "quiet-button"} disabled={busy || separationPending} onClick={joined ? leave : join}>{joined && <Icon name="logout" size={18} />}{joined ? t('Leave match as a player') : t('Join as a player')}</button>
          {missingRatings.length > 0 && <Link className="text-link" to={'/ratings?player=' + missingRatings[0].player_id}>{t('Rate missing players ({count})', { count: missingRatings.length })}</Link>}
        </> : !joined ? <button className="primary-button full-width" disabled={busy || separationPending} onClick={join}>{t('Join this match')}<Icon name="plus" /></button> : <>
          {missingRatings.length > 0 && <Link className="secondary-button full-width" to={'/ratings?player=' + missingRatings[0].player_id}>{t('Rate missing players ({count})', { count: missingRatings.length })}<Icon name="star" /></Link>}
          <button className="secondary-button full-width" onClick={invite}>{t('Copy match link')}<Icon name="link" /></button>
          {match.status === 'open' && <button type="button" className="secondary-button full-width match-leave-button" disabled={busy || separationPending} onClick={leave}><Icon name="logout" size={18} />{t("Leave this match")}</button>}
        </>}

        {showInvite && <div className="invite-box"><label htmlFor="invite-url">{copied ? t("Copied! Paste this in your group chat.") : t("Copy this link and send it to your friends.")}</label><input id="invite-url" readOnly value={window.location.origin + '/session/' + id} onFocus={event => event.target.select()} /><p role="status">{t("Friends sign in, then tap “Join this match.”")}</p></div>}
      </section><div className="info-note"><Icon name="shirt" /><p><strong>{t("How do I choose my team?")}</strong><br />{t("You join the match, then the organizer generates balanced sides using player ratings. Your team appears on the lineup screen.")}</p></div>

      </aside>
    </div>
    {organizer && <section className="club-details"><button className="quiet-button danger" onClick={() => setCancelConfirm(true)}>{t('Cancel match')}</button>{cancelConfirm && <div><p>{t('Cancel this match? All joined players will be notified.')}</p><div className="button-row"><button className="secondary-button" disabled={busy} onClick={() => run(async () => { const result = await supabase.rpc('cancel_match', { p_session_id: match.id }); if (result.error) throw new Error(t('Could not cancel the match.')); await fetchMatch() })}>{t('Confirm cancellation')}</button><button className="quiet-button" onClick={() => setCancelConfirm(false)}>{t('Keep match')}</button></div></div>}</section>}
    {organizer && match.status === 'open' && <details className="club-details"><summary>{t("Match settings")}</summary><div className="settings-content"><label htmlFor="rename-match">{t("Rename match")}</label><input id="rename-match" placeholder={match.name} value={editName} onChange={event => setEditName(event.target.value)} className="input-field" /><label htmlFor="edit-format">{t("Players per team")}</label><select id="edit-format" className="input-field" value={editSize ?? match.team_size} onChange={event => setEditSize(Number(event.target.value) as 5 | 6 | 8 | 11)}>{[5, 6, 8, 11].map(size => <option key={size} value={size}>{size} vs {size}</option>)}</select><button className="secondary-button" disabled={busy || (!editName.trim() && editSize === null)} onClick={() => run(async () => { const { error: issue } = await supabase.from('sessions').update({ name: editName.trim() || match.name, team_size: editSize ?? match.team_size }).eq('id', id!); if (issue) throw new Error(t("Could not rename this match.")); setEditName(''); setEditSize(null); await fetchMatch() })}>{t("Save changes")}</button><button className="quiet-button danger" onClick={() => setDeleteConfirm(true)}>{t("Delete match")}</button>{deleteConfirm && <div className="form-error"><p>{t("Delete this match and its player list? This cannot be undone.")}</p><div className="button-row"><button disabled={busy || separationPending} onClick={() => run(async () => { const { error: issue } = await supabase.from('sessions').delete().eq('id', id!); if (issue) throw new Error(t("Could not delete this match.")); navigate('/matches') })}>{t("Yes, delete match")}</button><button onClick={() => setDeleteConfirm(false)}>{t("Keep match")}</button></div></div>}</div></details>}
  </div>
}
