import { useI18n } from '../context/LanguageContext'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Icon from '../components/Icon'
import Avatar from '../components/Avatar'
import type { League } from '../lib/database.types'

type LeagueView = League & { league_players: { player_id: string; squad: number | null; profiles: { display_name: string } | null }[]; sessions: { count: number }[] }
const squadNames = ['Blue', 'Red', 'Green', 'Purple', 'Gold', 'Pink']
export default function Leagues() {
  const { t } = useI18n()

  const { user } = useAuth()
  const navigate = useNavigate()
  const [leagues, setLeagues] = useState<LeagueView[]>([])
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [size, setSize] = useState<5 | 6 | 8 | 11>(5)
  const [mine, setMine] = useState(false)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [createError, setCreateError] = useState('')
  const fetchLeagues = async () => {
    setError(''); setLoading(true)
    try {
      const { data, error: issue } = await supabase.from('leagues').select('*, league_players(player_id, squad, profiles(display_name)), sessions(count)').order('created_at', { ascending: false })
      if (issue) throw issue
      setLeagues((data ?? []) as unknown as LeagueView[])
    } catch { setError(t("Could not load the leagues. Please try again.")) }
    finally { setLoading(false) }
  }
  useEffect(() => { void fetchLeagues() }, [])
  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user || !name.trim() || busy) return
    setBusy(true); setCreateError('')
    try {
      const { data, error: issue } = await supabase.from('leagues').insert({ name: name.trim(), team_size: size, created_by: user.id }).select().single()
      if (issue || !data) throw issue
      const { error: joinIssue } = await supabase.from('league_players').insert({ league_id: data.id, player_id: user.id })
      navigate('/league/' + data.id, { state: { joinFailed: !!joinIssue } })
    } catch { setCreateError(t("Could not create the league. Please try again.")) }
    finally { setBusy(false) }
  }
  const visible = leagues.filter(league => league.name.toLowerCase().includes(search.toLowerCase()) && (!mine || league.created_by === user?.id || league.league_players.some(player => player.player_id === user?.id)))
  return <div className="page-stack"><div className="page-heading"><div><p className="overline">{t("THE SAME SQUAD. EVERY MATCHDAY.")}</p><h1>{t("Find your people.")}</h1><p>{t("Join a league, get a balanced squad, and play together all season.")}</p></div><button className="secondary-button" onClick={() => setCreating(true)}><Icon name="plus" size={17} />  {t("Create a league")}</button></div>
    {creating && <form className="club-panel setup-form" onSubmit={create}><div className="section-heading"><h2>{t("Start your own league")}</h2><button type="button" aria-label={t("Close league setup")} className="icon-button" onClick={() => setCreating(false)}><Icon name="close" /></button></div><p>{t("You’ll organize the league, invite players, and generate the squads.")}</p><label htmlFor="league-name">{t("League name")}</label><input id="league-name" className="input-field" value={name} onChange={event => setName(event.target.value)} placeholder={t("e.g. Friday Football Club")} required autoFocus /><label>{t("Players per team")}</label><div className="format-grid">{([5, 6, 8, 11] as const).map(number => <button type="button" className={'format-option ' + (number === size ? 'selected' : '')} key={number} aria-pressed={number === size} onClick={() => setSize(number)}><strong>{number}<i>v</i>{number}</strong><small>{t("At least")} {number * 2}  {t("players needed")}</small></button>)}</div>{createError && <p className="form-error" role="alert">{createError}</p>}<div className="setup-actions"><button type="button" className="secondary-button" onClick={() => setCreating(false)}>{t("Cancel")}</button><button className="primary-button" disabled={busy || !name.trim()}>{busy ? t("Creating...") : t("Create league & invite players")}<Icon name="arrow" /></button></div></form>}
    <div className="info-note"><Icon name="shirt" size={25} /><p><strong>{t("Looking for your team?")}</strong>  {t("Open your league below. Your assigned squad is highlighted. If squads haven’t been made yet, join the player list and the organizer will generate balanced teams.")}</p></div>
    <div className="browser-tools"><div className="filter-tabs"><button aria-pressed={!mine} className={!mine ? 'selected' : ''} onClick={() => setMine(false)}>{t("All leagues")}</button><button aria-pressed={mine} className={mine ? 'selected' : ''} onClick={() => setMine(true)}>{t("My leagues")}</button></div><label className="search-box"><Icon name="search" size={17} /><input aria-label={t("Search leagues")} placeholder={t("Find your league...")} value={search} onChange={event => setSearch(event.target.value)} /></label></div>
    {error ? <div className="empty-state" role="alert"><h3>{t("Leagues unavailable")}</h3><p>{error}</p><button className="secondary-button" onClick={fetchLeagues}>{t("Try again")}</button></div> : loading ? <div className="match-grid">{[0, 1].map(number => <div className="skeleton-card" key={number} />)}</div> : !visible.length ? <div className="empty-state"><Icon name="trophy" size={36} /><h3>{mine ? t("No league in your lineup yet.") : t("Your club could be the first.")}</h3><p>{mine ? t("Browse all leagues to find one to join.") : search ? t("Try a different league name.") : t("Create a league and bring your regular football group together.")}</p><button className="primary-button" onClick={() => { if (mine || search) { setMine(false); setSearch('') } else setCreating(true) }}>{mine || search ? t("Show all leagues") : t("Create a league")}</button></div> : <div className="match-grid">{visible.map(league => {
      const membership = league.league_players.find(player => player.player_id === user?.id)
      const generated = league.league_players.some(player => player.squad !== null)
      const myTeam = membership?.squad ? squadNames[(membership.squad - 1) % squadNames.length] : null
      return <Link key={league.id} to={'/league/' + league.id} className="match-card"><div className="league-card-art"><Icon name="trophy" size={64} /><span className="status-pill">{league.status === 'completed' ? t("SEASON COMPLETE") : generated ? t("SQUADS ASSIGNED") : t("BUILDING SQUADS")}</span>{membership && <span className="membership-badge"><Icon name="check" size={12} />  {t("Your league")}</span>}</div><div className="match-card-body"><span className="match-kind">{league.team_size}{t("-A-SIDE LEAGUE")}</span><h3>{league.name}</h3><p>{league.league_players.length} {t('players')} · {league.sessions[0]?.count ?? 0}  {t("matches")}{myTeam ? ' · ' + t('Your team: {color}', { color: t(myTeam) }) : membership ? ' · ' + t('Awaiting your squad') : ''}</p><div className="match-card-roster"><div className="avatar-stack">{league.league_players.slice(0, 4).map(player => <Avatar key={player.player_id} name={player.profiles?.display_name ?? t("Player")} size="sm" />)}</div><span>{league.league_players.length > 4 ? '+' + (league.league_players.length - 4) + ' ' + t('players') : t("The squad")}</span></div><div className="match-card-action">{myTeam ? t('See my team') + ' · ' + t(myTeam) : membership ? t("Open my league") : !generated && league.status === 'active' ? t("View & join league") : t("Explore teams")}<Icon name="arrow" size={18} /></div></div></Link>
    })}</div>}
  </div>
}
