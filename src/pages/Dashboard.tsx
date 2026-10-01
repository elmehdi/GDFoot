import { useRatingReminders } from '../context/RatingRemindersContext'
import { useI18n } from '../context/LanguageContext'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Avatar from '../components/Avatar'
import Icon from '../components/Icon'
import { useClubDirectory } from '../context/ClubDirectoryContext'
import type { Session } from '../lib/database.types'

type Match = Session & { session_players: { player_id: string; team: number | null; profiles: { display_name: string } | null }[] }
type Filter = 'all' | 'mine' | 'open' | 'ready'
const labels: Record<Filter, string> = { all: 'All matches', mine: 'My matches', open: 'Open to join', ready: 'Teams ready' }

export default function Dashboard() {
  const { t } = useI18n()
  const { pending } = useRatingReminders()

  const { user, profile } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const { stadiumName } = useClubDirectory()
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')
  const browsing = location.pathname === '/matches'
  const [matches, setMatches] = useState<Match[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const fetchMatches = async (silent = false) => {
    if (!silent) setLoading(true)
    setError('')
    try {
      const { data, error: issue } = await supabase.from('sessions').select('*, session_players!session_players_session_id_fkey(player_id, team, profiles(display_name))').order('created_at', { ascending: false })
      if (issue) throw issue
      setMatches((data ?? []).filter(match => !match.cancelled_at) as unknown as Match[])
    } catch (issue) {
      console.error('Match list could not be loaded:', issue)
      setError(t('We could not load matches. Please try again.'))
    }
    finally { if (!silent) setLoading(false) }
  }
  useEffect(() => {
    void fetchMatches()
    const refresh = () => { if (document.visibilityState === 'visible') void fetchMatches(true) }
    const interval = window.setInterval(refresh, 15000)
    window.addEventListener('focus', refresh)
    return () => { clearInterval(interval); window.removeEventListener('focus', refresh) }
  }, [user?.id])
  useEffect(() => {
    const requested = new URLSearchParams(location.search).get('filter')
    setFilter(requested && requested in labels ? requested as Filter : 'all')
    setSearch('')
  }, [location.pathname, location.search])
  const isMine = (match: Match) => match.created_by === user?.id || match.session_players.some(p => p.player_id === user?.id)
  const featured = matches.find(match => match.status === 'completed' && match.session_players.some(player => player.player_id === user?.id))
    ?? matches.find(match => match.status === 'open') ?? matches[0]
  const visible = matches.filter(match => match.name.toLowerCase().includes(search.toLowerCase()) && (filter === 'all' || filter === 'mine' && isMine(match) || filter === 'open' && match.status === 'open' || filter === 'ready' && match.status === 'completed'))
  const target = (match: Match) => match.status === 'completed' ? '/results/' + match.id : '/session/' + match.id
  const action = (match: Match) => match.status === 'completed' ? (isMine(match) ? t("See my team") : t("View lineup")) : isMine(match) ? (match.status === 'voting' ? t("Open my match") : t("Open my match")) : match.status === 'open' ? t("View & join match") : t("View match")
  const joinFeatured = async () => {
    if (!featured || !user || joining) return
    setJoining(true); setJoinError('')
    try {
      const { error: issue } = await supabase.from('session_players').insert({ session_id: featured.id, player_id: user.id })
      if (issue && issue.code !== '23505') throw issue
      navigate('/session/' + featured.id)
    } catch { setJoinError(t("Could not join the match. Please try again.")) }
    finally { setJoining(false) }
  }
  const displayed = browsing ? visible : visible.filter(match => match.id !== featured?.id).slice(0, 6)
  return <div className="page-stack">
    <div className="page-heading"><div><p className="overline">{browsing ? t("FIND YOUR NEXT GAME") : t("YOUR FOOTBALL, ORGANIZED")}</p><h1>{browsing ? t("The match board.") : t('Letâ€™s play{name}.', { name: profile?.display_name ? ', ' + profile.display_name.split(' ')[0] : '' })}</h1><p>{browsing ? t("Choose a match, see whoâ€™s playing, and join in.") : t("Your games, your people. Everything you need to get on the pitch.")}</p></div><div className="match-heading-actions">{!browsing && <Link className="primary-button" to={pending.length ? "/ratings?player=" + pending[0].player_id : "/ratings"}><Icon name="star" size={17} />{t("Rate the players")}</Link>}<Link to="/matches?filter=open" className="secondary-button join-action"><Icon name="matches" size={17} />{t("Join a match")}</Link><Link to="/matches/new" className={(browsing ? "primary-button" : "secondary-button") + " organize-action"}><Icon name="plus" size={17} />  {t("Organize a match")}</Link></div></div>
    {!browsing && <section className="feature-banner">
      <div className="feature-copy"><span className="feature-label"><span />  {t("THE BEAUTIFUL GAME. BETTER BALANCED.")}</span><h2>{t("Rate your squad.")}<br /><em>{t("Fair sides.")}</em></h2><p>{t("Start with your private player ratings. They help balance every match.")}</p><Link className="primary-button" to={pending.length ? "/ratings?player=" + pending[0].player_id : "/ratings"}>{pending.length ? t("{count} players to rate", { count: pending.length }) : t("Review my ratings")}<Icon name="arrow" size={17} /></Link></div>
      <div className="jersey-composition" aria-hidden="true"><span className="orbit orbit-one" /><span className="orbit orbit-two" /><span className="graphic-caption">{t("TWO SIDES.")}<br />{t("ONE GREAT GAME.")}</span><div className="jersey jersey-blue"><svg viewBox="0 0 200 240"><path d="M65 18 12 45 32 97 55 87v139h90V87l23 10 20-52-53-27Q100 48 65 18Z" fill="currentColor" /><path d="M65 18Q100 62 135 18M55 87V45m90 42V45" fill="none" stroke="white" strokeOpacity=".3" strokeWidth="3" /></svg><span>G&D<b>07</b></span></div><div className="jersey jersey-lime"><svg viewBox="0 0 200 240"><path d="M65 18 12 45 32 97 55 87v139h90V87l23 10 20-52-53-27Q100 48 65 18Z" fill="currentColor" /><path d="M65 18Q100 62 135 18M55 87V45m90 42V45" fill="none" stroke="#263620" strokeOpacity=".3" strokeWidth="3" /></svg><span>G&D<b>10</b></span></div><div className="fair-play-stamp">FAIR<br /><b>PLAY</b><span>FOOTBALL CLUB</span></div></div>
    </section>}
    {!browsing && (loading ? <div className="featured-match-loading" role="status">{t("Finding the latest match...")}</div> : !error && featured ? <section className="featured-match" aria-label={t("Featured match")}>
      <div className="featured-match-heading"><span className="overline"><span className="live-dot" />{featured.status === 'completed' && featured.session_players.some(player => player.player_id === user?.id) ? t("YOUR TEAMS ARE READY") : featured.status === 'open' ? t("LATEST OPEN MATCH") : t("LATEST MATCH")}</span><span className="featured-format">{featured.team_size} vs {featured.team_size}</span></div>
      <div className="featured-match-content"><div className="featured-match-details"><h2>{featured.name}</h2>{featured.scheduled_at && <p>{new Date(featured.scheduled_at).toLocaleString()}</p>}<p className="venue-label"><Icon name="pin" size={17} />{stadiumName(featured.stadium_id)}</p><p>{featured.status === 'open' ? Math.max(0, featured.team_size * 2 - featured.session_players.length) > 0 ? t('{count} more players needed. Your squad is waiting.', { count: Math.max(0, featured.team_size * 2 - featured.session_players.length) }) : t("The player list is ready. Open the match for the next step.") : featured.status === 'voting' ? t("The organizer is preparing the teams.") : t("The teams have been generated. Check the lineup.")}</p><div className="featured-roster"><div className="avatar-stack">{featured.session_players.slice(0, 5).map(player => <Avatar key={player.player_id} name={player.profiles?.display_name ?? t("Player")} size="sm" />)}</div><span>{featured.session_players.length}  {t("players joined")}</span>{isMine(featured) && <span className="you-badge">{featured.created_by === user?.id ? t("ORGANIZING") : t("YOU ARE IN")}</span>}</div></div>
      <div className="featured-match-cta">{featured.status === 'open' && !isMine(featured) ? <button className="primary-button" onClick={joinFeatured} disabled={joining}>{joining ? t("Joining...") : t("Join this match")}<Icon name="arrow" /></button> : <Link className="primary-button" to={target(featured)}>{action(featured)}<Icon name="arrow" /></Link>}<Link to={target(featured)} className="text-link">{t("See match details")}</Link></div></div>{joinError && <p className="form-error" role="alert">{joinError}</p>}
    </section> : !error ? <div className="empty-state"><Icon name="matches" size={30} /><h3>{t("Your next match starts here.")}</h3><p>{t("Organize a match and invite the squad.")}</p><Link to="/matches/new" className="primary-button">{t("Organize a match")}<Icon name="plus" size={16} /></Link></div> : null)}
    {(browsing || matches.length > 1 || !!error) && <section className="match-browser">

      <div className="section-heading"><div><span className="overline">{t("GET INVOLVED")}</span><h2>{browsing ? t("Pick your match") : t("More from Go&Dev")}</h2></div>{!browsing && <Link to="/matches" className="text-link">{t("All matches")} <Icon name="arrow" size={16} /></Link>}</div>
      {browsing && <div className="browser-tools"><div className="filter-tabs" aria-label={t("Filter matches")}>{(Object.keys(labels) as Filter[]).map(key => <button key={key} aria-pressed={filter === key} className={filter === key ? 'selected' : ''} onClick={() => setFilter(key)}>{t(labels[key])}</button>)}</div><label className="search-box"><Icon name="search" size={17} /><input aria-label={t("Search matches")} value={search} onChange={e => setSearch(e.target.value)} placeholder={t("Search matches...")} /></label></div>}
      {error ? <div className="empty-state" role="alert"><Icon name="refresh" size={32} /><h3>{t("Letâ€™s try that again.")}</h3><p>{error}</p><button className="secondary-button" onClick={() => void fetchMatches()}>{t("Reload matches")}</button></div> : loading ? <div className="match-grid" aria-label={t("Loading matches")}>{[0, 1, 2].map(n => <div key={n} className="skeleton-card" />)}</div> : !displayed.length ? <div className="empty-state"><Icon name="matches" size={36} /><h3>{search ? t("No matches with that name.") : filter === 'mine' ? t("Your match list starts here.") : t("No matches here yet.")}</h3><p>{search ? t("Try another name or clear your search.") : filter === 'mine' ? t("Join an open match and it will appear here.") : t("Organize a game and invite your friends to get things started.")}</p><div className="button-row">{(search || filter !== 'all') && <button className="secondary-button" onClick={() => { setSearch(''); setFilter('all') }}>{t("Show all matches")}</button>}<Link to="/matches/new" className="primary-button">{t("Organize a match")} <Icon name="plus" size={16} /></Link></div></div> : <div className="match-grid">{displayed.map((match, index) => <Link key={match.id} to={target(match)} className={'match-card ' + (browsing && index === 0 ? 'match-card-latest' : '')}><div className={'match-card-art status-' + match.status}><span className="format-number">{match.team_size}<i>v</i>{match.team_size}</span><div className="card-pitch-lines" aria-hidden="true" /><span className="status-pill">{match.status === 'open' ? t("OPEN TO JOIN") : match.status === 'voting' ? t("PREPARING TEAMS") : t("TEAMS READY")}</span>{isMine(match) && <span className="membership-badge"><Icon name="check" size={12} /> {match.created_by === user?.id ? t("Organizing") : t("Joined")}</span>}</div><div className="match-card-body"><span className="match-kind">{browsing && index === 0 ? t("LATEST IN THIS LIST") : match.league_id ? t("LEAGUE MATCH") : t("PICKUP FOOTBALL")}</span><h3>{match.name}</h3>{match.scheduled_at && <p>{new Date(match.scheduled_at).toLocaleString()}</p>}<p className="venue-label"><Icon name="pin" size={14} />{stadiumName(match.stadium_id)}</p><p>{match.session_players.length}  {t("players")}{match.status === 'open' ? t(' / {count} more for {size}v{size}', { count: Math.max(0, match.team_size * 2 - match.session_players.length), size: match.team_size }) : ' / ' + (match.locked ? t("Lineup confirmed") : t("Balance in progress"))}</p><div className="match-card-roster"><div className="avatar-stack">{match.session_players.slice(0, 4).map(player => <Avatar key={player.player_id} name={player.profiles?.display_name ?? t("Player")} size="sm" />)}</div><span>{match.session_players.length > 4 ? t('+{count} more', { count: match.session_players.length - 4 }) : match.session_players.length ? t("The squad") : t("Be the first to join")}</span></div><div className="match-card-action">{action(match)}<Icon name="arrow" size={18} /></div></div></Link>)}</div>}
    </section>}
    {!browsing && <section className="how-it-works"><div><span className="overline">{t("NEW HERE?")}</span><h2>{t("From â€œwhoâ€™s in?â€")}<br />{t("to kick-off.")}</h2></div>{[{ n: '01', title: t("Rate the players"), body: t("Start with your private player ratings. They help balance every match.") }, { n: '02', title: t("Join a match"), body: t("Find your game and add yourself to the player list.") }, { n: '03', title: t("Meet your team"), body: t("Check your team and teammates. Youâ€™re ready to play.") }].map(step => <div key={step.n}><span className="how-number">{step.n}</span><h3>{t(step.title)}</h3><p>{t(step.body)}</p></div>)}</section>}
  </div>
}

