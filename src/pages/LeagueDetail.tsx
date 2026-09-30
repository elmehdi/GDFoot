import { useI18n } from '../context/LanguageContext'
import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Avatar from '../components/Avatar'
import LeagueMatchPicker from '../components/LeagueMatchPicker'
import Icon from '../components/Icon'
import type { League, Profile, Session } from '../lib/database.types'

const SQUAD_COLORS = [
  { bg: 'from-blue-600/20 to-blue-900/10', border: 'border-blue-500/30', dot: 'bg-blue-500', text: 'text-blue-400', name: 'Blue' },
  { bg: 'from-red-600/20 to-red-900/10', border: 'border-red-500/30', dot: 'bg-red-500', text: 'text-red-400', name: 'Red' },
  { bg: 'from-emerald-600/20 to-emerald-900/10', border: 'border-emerald-500/30', dot: 'bg-emerald-500', text: 'text-emerald-400', name: 'Green' },
  { bg: 'from-purple-600/20 to-purple-900/10', border: 'border-purple-500/30', dot: 'bg-purple-500', text: 'text-purple-400', name: 'Purple' },
  { bg: 'from-amber-600/20 to-amber-900/10', border: 'border-amber-500/30', dot: 'bg-amber-500', text: 'text-amber-400', name: 'Gold' },
  { bg: 'from-pink-600/20 to-pink-900/10', border: 'border-pink-500/30', dot: 'bg-pink-500', text: 'text-pink-400', name: 'Pink' },
]

const getSquadColor = (n: number) => SQUAD_COLORS[(n - 1) % SQUAD_COLORS.length]

interface SquadStanding {
  squad_number: number
  played: number
  won: number
  drawn: number
  lost: number
  goals_for: number
  goals_against: number
  goal_difference: number
  points: number
}

interface LeaguePlayerWithSquad extends Profile {
  squad: number | null
}

interface MatchDay extends Session {
  match_result: { team_1_goals: number; team_2_goals: number } | null
}

export default function LeagueDetail() {
  const { t } = useI18n()

  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [league, setLeague] = useState<League | null>(null)
  const [players, setPlayers] = useState<LeaguePlayerWithSquad[]>([])
  const [standings, setStandings] = useState<SquadStanding[]>([])
  const [matches, setMatches] = useState<MatchDay[]>([])
  const [isCreator, setIsCreator] = useState(false)
  const [hasJoined, setHasJoined] = useState(false)
  const [squadsGenerated, setSquadsGenerated] = useState(false)
  const [numSquads, setNumSquads] = useState(0)
  const [loading, setLoading] = useState(true)
  const [generatingSquads, setGeneratingSquads] = useState(false)
  const [tab, setTab] = useState<'standings' | 'matches' | 'squads'>('squads')
  const [actionError, setActionError] = useState('')
  const [working, setWorking] = useState(false)
  const [inviteVisible, setInviteVisible] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'redraw' | 'end' | 'delete' | null>(null)
  const [creatingMatch, setCreatingMatch] = useState(false)

  const fetchData = async () => {
    if (!id || !user) return

    const { data: leagueData } = await supabase
      .from('leagues')
      .select('*')
      .eq('id', id)
      .single()

    if (leagueData) {
      setLeague(leagueData)
      setIsCreator(leagueData.created_by === user.id)
    }

    // Fetch players with squad assignments
    const { data: playerData } = await supabase
      .from('league_players')
      .select('player_id, squad, profiles(id, display_name, avatar_url, created_at)')
      .eq('league_id', id)

    if (playerData) {
      const mapped = playerData.map((lp) => ({
        ...(lp.profiles as unknown as Profile),
        squad: lp.squad,
      }))
      setPlayers(mapped)
      setHasJoined(mapped.some((p) => p.id === user.id))
      const hasSquads = mapped.some((p) => p.squad !== null)
      setSquadsGenerated(hasSquads)
      if (hasSquads) {
        const maxSquad = new Set(mapped.filter((p) => p.squad !== null).map((p) => p.squad!)).size
        setNumSquads(maxSquad)
      }
    }

    // Fetch standings
    const { data: standingsData } = await supabase.rpc('get_league_standings', { p_league_id: id })
    if (standingsData) setStandings(standingsData as SquadStanding[])

    // Fetch matches
    const { data: matchData } = await supabase
      .from('sessions')
      .select('*, match_results(team_1_goals, team_2_goals)')
      .eq('league_id', id)
      .order('created_at', { ascending: false })

    if (matchData) {
      const mapped = matchData.map((s) => ({
        ...s,
        match_result: (s.match_results as unknown as { team_1_goals: number; team_2_goals: number }[])?.[0] ?? null,
      }))
      setMatches(mapped)
    }

    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id, user])

  const perform = async (operation: () => Promise<void>) => {
    if (working) return
    setWorking(true); setActionError('')
    try { await operation(); setConfirmAction(null) }
    catch { setActionError(t("That action could not be completed. Please try again.")) }
    finally { setWorking(false); setGeneratingSquads(false) }
  }
  const joinLeague = () => perform(async () => {
    if (!id || !user) return
    const { error } = await supabase.from('league_players').insert({ league_id: id, player_id: user.id })
    if (error && error.code !== '23505') throw error
    await fetchData()
  })
  const leaveLeague = () => perform(async () => {
    const { error } = await supabase.from('league_players').delete().eq('league_id', id!).eq('player_id', user!.id)
    if (error) throw error
    await fetchData()
  })
  const generateSquads = () => perform(async () => {
    setGeneratingSquads(true)
    const { error } = await supabase.rpc('generate_league_squads', { p_league_id: id! })
    if (error) throw error
    await fetchData(); setTab('squads')
  })
  const deleteLeague = () => perform(async () => {
    const { error } = await supabase.from('leagues').delete().eq('id', id!)
    if (error) throw error
    navigate('/leagues')
  })
  const endLeague = () => perform(async () => {
    const { error } = await supabase.from('leagues').update({ status: 'completed' }).eq('id', id!)
    if (error) throw error
    await fetchData()
  })
  const invite = async () => {
    setInviteVisible(true)
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true) } catch { setCopied(false) }
  }

  if (loading) return (
    <div className="text-center py-16">
      <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
      <p className="text-slate-400">{t("Loading league...")}</p>
    </div>
  )
  if (!league) return <div className="text-center text-red-400 py-12">{t("League not found")}</div>

  // Group players by squad
  const squads = new Map<number, LeaguePlayerWithSquad[]>()
  const unassigned: LeaguePlayerWithSquad[] = []
  players.forEach((p) => {
    if (p.squad && p.squad > 0) {
      const list = squads.get(p.squad) ?? []
      list.push(p)
      squads.set(p.squad, list)
    } else {
      unassigned.push(p)
    }
  })

  const championSquad = standings.length > 0 && league.status === 'completed' ? standings[0] : null
  const squadNumbers = Array.from(squads.keys()).sort((a, b) => a - b)

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/leagues')} className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
         {t("All Leagues")} </button>

      {/* League header */}
      <div className="club-panel">
        <div className="flex flex-wrap gap-4 items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl font-semibold text-white flex items-center gap-3">
              {league.name}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border ${
                league.status === 'active'
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                  : 'bg-slate-500/15 text-slate-400 border-slate-500/25'
              }`}>
                <span className="pulse-dot" style={{ background: 'currentColor' }} />
                {league.status === 'active' ? t("Active") : t("Completed")}
              </span>
              <span className="text-slate-400 text-sm">
                {players.length} {t('players')} · {league.team_size}v{league.team_size} · {numSquads > 0 ? t('{count} squads', { count: numSquads }) : t("No squads yet")}
              </span>
            </div>
          </div>
        </div>

        <div className="button-row">
          {!hasJoined && league.status === 'active' && !squadsGenerated && <button disabled={working} onClick={joinLeague} className="primary-button">{t("Join league")} <Icon name="plus" size={16} /></button>}
          {isCreator && league.status === 'active' && !squadsGenerated && players.length >= league.team_size * 2 && <button disabled={working} onClick={generateSquads} className="primary-button">{generatingSquads ? t("Balancing squads...") : t("Generate balanced squads")}<Icon name="teams" /></button>}
          {isCreator && league.status === 'active' && squadsGenerated && <button className="primary-button" onClick={() => { setCreatingMatch(true); setTimeout(() => document.getElementById('matchup-picker')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0) }}>{t("Choose teams for a match")}<Icon name="arrow" /></button>}
          {hasJoined && !squadsGenerated && league.status === 'active' && <button className={isCreator && players.length < league.team_size * 2 ? 'primary-button' : 'secondary-button'} onClick={invite}>{t("Invite players")} <Icon name="link" size={16} /></button>}
          {hasJoined && !isCreator && !squadsGenerated && league.status === 'active' && <button disabled={working} onClick={leaveLeague} className="quiet-button">{t("Leave league")}</button>}
        </div>
        {inviteVisible && <div className="invite-box"><label htmlFor="league-invite">{copied ? t("Copied. Paste this into your group chat.") : t("Copy this link to invite your friends.")}</label><input id="league-invite" readOnly value={window.location.href} onFocus={event => event.target.select()} /></div>}
      </div>
      {actionError && <div role="alert" className="form-error">{actionError}</div>}
      {isCreator && <details className="club-details"><summary>{t("League settings")}</summary><div className="button-row mt-3">{league.status === 'active' && squadsGenerated && <button className="secondary-button" onClick={() => setConfirmAction('redraw')}>{t("Redraw squads")}</button>}{league.status === 'active' && <button className="secondary-button" onClick={() => setConfirmAction('end')}>{t("End season")}</button>}<button className="quiet-button danger" onClick={() => setConfirmAction('delete')}>{t("Delete league")}</button></div>{confirmAction && <div className="form-error mt-4"><p>{confirmAction === 'redraw' ? t("Redraw every squad? Existing player assignments will change. Previous match lineups stay as recorded.") : confirmAction === 'end' ? t("End this season? New matches will no longer be available from this league.") : t("Delete this league? This cannot be undone.")}</p><div className="button-row"><button disabled={working} className="secondary-button" onClick={confirmAction === 'redraw' ? generateSquads : confirmAction === 'end' ? endLeague : deleteLeague}>{working ? t("Please wait...") : t("Confirm")}</button><button className="quiet-button" onClick={() => setConfirmAction(null)}>{t("Cancel")}</button></div></div>}</details>}

      <section className="club-panel league-guidance"><Icon name="shirt" size={32} /><div><span className="overline">{t("YOUR PLACE IN THE LEAGUE")}</span><h2>{players.find(p => p.id === user?.id)?.squad ? t("You play for ") + t(getSquadColor(players.find(p => p.id === user?.id)!.squad!).name) : hasJoined ? t("You are on the player list") : squadsGenerated ? t("The squads are already set") : t("Join the league to get a team")}</h2><p>{squadsGenerated ? isCreator ? t("Choose two squads to create a match. Review each roster before confirming.") : hasJoined ? t("Your squad stays together for the season. Check Matches for your next game.") : t("Teams have been assigned for this season. Ask the organizer about joining.") : hasJoined ? isCreator ? t('{count} players needed before generating squads.', { count: Math.max(0, league.team_size * 2 - players.length) }) : t("The organizer will assign you a balanced squad once enough players join.") : t("Tap Join League above. The organizer assigns teams using player ratings.")}</p></div></section>
      {/* Champion banner */}
      {championSquad && league.status === 'completed' && (
        <div className="bg-gradient-to-r from-amber-600/20 via-amber-500/10 to-amber-600/20 border border-amber-500/30 rounded-2xl p-6 text-center">
          <div className="text-4xl mb-2">👑</div>
          <p className="text-amber-400 text-xs font-bold uppercase tracking-widest mb-1">{t("Champions")}</p>
          <div className="flex items-center justify-center gap-3">
            <div className={`w-4 h-4 rounded-full ${getSquadColor(championSquad.squad_number).dot}`} />
            <p className="text-2xl font-extrabold text-white">{t("Squad")} {t(getSquadColor(championSquad.squad_number).name)}</p>
          </div>
          <p className="text-amber-400 text-sm font-bold mt-1">{championSquad.points}  {t("pts ·")} {championSquad.won}W {championSquad.drawn}D {championSquad.lost}L</p>
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            {(squads.get(championSquad.squad_number) ?? []).map((p) => (
              <div key={p.id} className="flex items-center gap-1.5 bg-amber-500/10 rounded-full pl-1 pr-3 py-1">
                <Avatar name={p.display_name} size="sm" />
                <Link className="player-name-link text-white text-xs font-medium" to={"/ratings?player=" + p.id}>{p.display_name}</Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {creatingMatch && <LeagueMatchPicker leagueId={id!} squads={squads} onCancel={() => setCreatingMatch(false)} onCreated={matchId => navigate('/results/' + matchId)} />}

      {/* Tabs */}
      <div className="flex bg-slate-800/60 rounded-xl p-1">
        {(['squads', 'matches', 'standings'] as const).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all capitalize ${
              tab === tabKey ? 'btn-gold' : 'text-slate-400 hover:text-white'
            }`}
          >
            {tabKey === 'standings' ? t("Standings") : tabKey === 'matches' ? t("Matches") : t("Squads")}
          </button>
        ))}
      </div>

      {/* Standings tab — per squad */}
      {tab === 'standings' && (
        <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl overflow-hidden">
          {standings.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400 text-sm">{t("No match results yet. Play some games to see standings!")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    <th className="text-left text-slate-400 font-semibold px-4 py-3 text-xs uppercase tracking-wider">#</th>
                    <th className="text-left text-slate-400 font-semibold px-4 py-3 text-xs uppercase tracking-wider">{t("Squad")}</th>
                    <th className="text-center text-slate-400 font-semibold px-2 py-3 text-xs uppercase tracking-wider">{t("P")}</th>
                    <th className="text-center text-slate-400 font-semibold px-2 py-3 text-xs uppercase tracking-wider">{t("W")}</th>
                    <th className="text-center text-slate-400 font-semibold px-2 py-3 text-xs uppercase tracking-wider">{t("D")}</th>
                    <th className="text-center text-slate-400 font-semibold px-2 py-3 text-xs uppercase tracking-wider">{t("L")}</th>
                    <th className="text-center text-slate-400 font-semibold px-2 py-3 text-xs uppercase tracking-wider">{t("GF")}</th>
                    <th className="text-center text-slate-400 font-semibold px-2 py-3 text-xs uppercase tracking-wider">{t("GA")}</th>
                    <th className="text-center text-slate-400 font-semibold px-2 py-3 text-xs uppercase tracking-wider">{t("GD")}</th>
                    <th className="text-center text-amber-400 font-bold px-2 py-3 text-xs uppercase tracking-wider">{t("PTS")}</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((s, idx) => {
                    const color = getSquadColor(s.squad_number)
                    return (
                      <tr
                        key={s.squad_number}
                        className={`border-b border-slate-800/40 ${idx === 0 ? 'bg-amber-500/5' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <span className={`text-sm font-bold ${
                            idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-amber-700' : 'text-slate-500'
                          }`}>
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-3 h-3 rounded-full ${color.dot}`} />
                            <span className={`font-bold text-sm ${color.text}`}>{t(color.name)}</span>
                          </div>
                        </td>
                        <td className="text-center text-slate-300 px-2 py-3">{s.played}</td>
                        <td className="text-center text-emerald-400 font-medium px-2 py-3">{s.won}</td>
                        <td className="text-center text-slate-400 px-2 py-3">{s.drawn}</td>
                        <td className="text-center text-red-400 px-2 py-3">{s.lost}</td>
                        <td className="text-center text-slate-300 px-2 py-3">{s.goals_for}</td>
                        <td className="text-center text-slate-400 px-2 py-3">{s.goals_against}</td>
                        <td className="text-center px-2 py-3">
                          <span className={s.goal_difference > 0 ? 'text-emerald-400' : s.goal_difference < 0 ? 'text-red-400' : 'text-slate-400'}>
                            {s.goal_difference > 0 ? '+' : ''}{s.goal_difference}
                          </span>
                        </td>
                        <td className="text-center px-2 py-3">
                          <span className="text-amber-400 font-extrabold text-base">{s.points}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Matches tab */}
      {tab === 'matches' && (
        <div className="space-y-3">
          {matches.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/40 rounded-2xl border border-slate-800/40">
              <p className="text-slate-400 text-sm">{t("No matches yet. Create a match day to get started!")}</p>
            </div>
          ) : (
            matches.map((m) => {
              const hc = m.home_squad ? getSquadColor(m.home_squad) : SQUAD_COLORS[0]
              const ac = m.away_squad ? getSquadColor(m.away_squad) : SQUAD_COLORS[1]
              return (
                <div
                  key={m.id}
                  className="card-hover glass-card rounded-2xl p-5 cursor-pointer"
                  onClick={() => navigate(`/results/${m.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-xs text-slate-500 font-medium mb-2">{m.name}</p>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2.5 h-2.5 rounded-full ${hc.dot}`} />
                          <span className={`font-bold text-sm ${hc.text}`}>{t(hc.name)}</span>
                        </div>

                        {m.match_result ? (
                          <div className="flex items-center gap-2">
                            <span className="text-white font-extrabold text-lg">{m.match_result.team_1_goals}</span>
                            <span className="text-slate-600 text-xs">—</span>
                            <span className="text-white font-extrabold text-lg">{m.match_result.team_2_goals}</span>
                          </div>
                        ) : (
                          <span className="text-slate-600 text-xs font-bold">vs</span>
                        )}

                        <div className="flex items-center gap-1.5">
                          <div className={`w-2.5 h-2.5 rounded-full ${ac.dot}`} />
                          <span className={`font-bold text-sm ${ac.text}`}>{t(ac.name)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {m.match_result ? (
                        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                          m.match_result.team_1_goals > m.match_result.team_2_goals
                            ? `${hc.text} bg-slate-800/60`
                            : m.match_result.team_2_goals > m.match_result.team_1_goals
                              ? `${ac.text} bg-slate-800/60`
                              : 'text-slate-400 bg-slate-800/60'
                        }`}>
                          {m.match_result.team_1_goals > m.match_result.team_2_goals
                            ? t('{color} wins', { color: t(hc.name) })
                            : m.match_result.team_2_goals > m.match_result.team_1_goals
                              ? t('{color} wins', { color: t(ac.name) })
                              : t("Draw")}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">{t("Awaiting score")}</span>
                      )}
                      <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Squads tab */}
      {tab === 'squads' && (
        <div className="space-y-4">
          {!squadsGenerated ? (
            <div className="text-center py-16 bg-slate-900/40 rounded-3xl border border-slate-800/40">
              <div className="text-5xl mb-3">👕</div>
              <p className="text-lg text-white font-bold">{t("Squads not generated yet")}</p>
              <p className="text-slate-400 text-sm mt-1.5 max-w-sm mx-auto">
                 {t("Need at least")} {league.team_size * 2}  {t("players to form squads. Currently")} {players.length}  {t("joined.")} </p>
              {isCreator && players.length >= league.team_size * 2 && (
                <button
                  onClick={generateSquads}
                  disabled={generatingSquads}
                  className="mt-5 btn-gold py-2.5 px-6 rounded-xl text-sm disabled:opacity-50"
                >
                  {generatingSquads ? t("Generating...") : '⚡ Generate Squads'}
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {squadNumbers.map((n) => {
                const color = getSquadColor(n)
                const members = squads.get(n) ?? []
                const standing = standings.find((s) => s.squad_number === n)
                return (
                  <div key={n} className={`bg-gradient-to-br ${color.bg} border ${color.border} rounded-2xl p-5 ${members.some(p => p.id === user?.id) ? 'my-squad-card' : ''}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${color.dot}`} />
                        <span className={`font-bold ${color.text}`}>{t("Squad")} {t(color.name)}{members.some(p => p.id === user?.id) && <span className="you-badge ml-3">{t("YOUR TEAM")}</span>}</span>
                      </div>
                      {standing && (
                        <span className="text-xs text-slate-400">
                          {standing.points}{t("pts ·")} {standing.won}W {standing.drawn}D {standing.lost}L
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {members.map((p) => (
                        <div key={p.id} className="flex items-center gap-2.5 bg-slate-900/40 rounded-lg px-3 py-2">
                          <Avatar name={p.display_name} size="sm" />
                          <Link className="player-name-link text-white font-medium text-sm" to={"/ratings?player=" + p.id}>{p.display_name}</Link>
                          {p.id === user?.id && <span className="text-blue-400 text-xs">{t("(you)")}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {unassigned.length > 0 && squadsGenerated && (
            <div className="bg-slate-800/40 border border-slate-700/30 rounded-2xl p-4">
              <p className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-2">{t("Unassigned")}</p>
              <div className="flex flex-wrap gap-2">
                {unassigned.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 bg-slate-900/50 rounded-lg px-3 py-2">
                    <Avatar name={p.display_name} size="sm" />
                    <Link className="player-name-link text-slate-400 text-sm" to={"/ratings?player=" + p.id}>{p.display_name}</Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
