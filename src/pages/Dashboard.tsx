import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Avatar from '../components/Avatar'
import type { Session, League } from '../lib/database.types'

const SQUAD_COLORS = [
  { dot: 'bg-blue-500', text: 'text-blue-400', name: 'Blue' },
  { dot: 'bg-red-500', text: 'text-red-400', name: 'Red' },
  { dot: 'bg-emerald-500', text: 'text-emerald-400', name: 'Green' },
  { dot: 'bg-purple-500', text: 'text-purple-400', name: 'Purple' },
  { dot: 'bg-amber-500', text: 'text-amber-400', name: 'Gold' },
  { dot: 'bg-pink-500', text: 'text-pink-400', name: 'Pink' },
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

interface RecentMatch {
  id: string
  name: string
  home_squad: number | null
  away_squad: number | null
  league_id: string | null
  created_at: string
  team_1_goals: number
  team_2_goals: number
}

interface MyLeague extends League {
  my_squad: number | null
  player_count: number
}

export default function Dashboard() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<(Session & { player_count: number })[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [teamSize, setTeamSize] = useState<5 | 6 | 8 | 11>(5)
  const [loading, setLoading] = useState(true)
  const [myLeagues, setMyLeagues] = useState<MyLeague[]>([])
  const [leagueStandings, setLeagueStandings] = useState<Map<string, SquadStanding[]>>(new Map())
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([])

  const fetchSessions = async () => {
    const { data } = await supabase
      .from('sessions')
      .select('*, session_players(count)')
      .is('league_id', null)
      .order('created_at', { ascending: false })
      .limit(5)

    if (data) {
      const mapped = data.map((s) => ({
        ...s,
        player_count: (s.session_players as unknown as { count: number }[])[0]?.count ?? 0,
      }))
      setSessions(mapped)
    }
    setLoading(false)
  }

  const fetchLeagueData = async () => {
    if (!user) return

    // Get leagues the user is part of
    const { data: myLpData } = await supabase
      .from('league_players')
      .select('league_id, squad, leagues(id, name, created_by, team_size, status, created_at)')
      .eq('player_id', user.id)

    if (!myLpData || myLpData.length === 0) return

    const leagueIds = myLpData.map((lp) => (lp.leagues as unknown as League).id)

    // Get player counts per league
    const { data: allLps } = await supabase
      .from('league_players')
      .select('league_id')
      .in('league_id', leagueIds)

    const counts = new Map<string, number>()
    allLps?.forEach((lp) => {
      counts.set(lp.league_id, (counts.get(lp.league_id) ?? 0) + 1)
    })

    const leagues: MyLeague[] = myLpData.map((lp) => {
      const l = lp.leagues as unknown as League
      return {
        ...l,
        my_squad: lp.squad,
        player_count: counts.get(l.id) ?? 0,
      }
    })
    setMyLeagues(leagues)

    // Fetch standings for active leagues
    const standingsMap = new Map<string, SquadStanding[]>()
    for (const l of leagues.filter((l) => l.status === 'active')) {
      const { data } = await supabase.rpc('get_league_standings', { p_league_id: l.id })
      if (data && data.length > 0) standingsMap.set(l.id, data as SquadStanding[])
    }
    setLeagueStandings(standingsMap)

    // Fetch recent league match results
    const { data: matchData } = await supabase
      .from('sessions')
      .select('id, name, home_squad, away_squad, league_id, created_at, match_results(team_1_goals, team_2_goals)')
      .in('league_id', leagueIds)
      .not('home_squad', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5)

    if (matchData) {
      const mapped: RecentMatch[] = matchData
        .filter((m) => {
          const mr = (m.match_results as unknown as { team_1_goals: number; team_2_goals: number }[])?.[0]
          return mr !== undefined
        })
        .map((m) => {
          const mr = (m.match_results as unknown as { team_1_goals: number; team_2_goals: number }[])[0]
          return {
            id: m.id,
            name: m.name,
            home_squad: m.home_squad,
            away_squad: m.away_squad,
            league_id: m.league_id,
            created_at: m.created_at,
            team_1_goals: mr.team_1_goals,
            team_2_goals: mr.team_2_goals,
          }
        })
      setRecentMatches(mapped)
    }
  }

  useEffect(() => {
    fetchSessions()
    fetchLeagueData()
  }, [user])

  const createSession = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    const { data, error } = await supabase
      .from('sessions')
      .insert({ name: newName, created_by: user.id, team_size: teamSize })
      .select()
      .single()

    if (!error && data) {
      await supabase.from('session_players').upsert({
        session_id: data.id,
        player_id: user.id,
      }, { onConflict: 'session_id,player_id' })
      setNewName('')
      setShowCreate(false)
      fetchSessions()
    }
  }

  const joinSession = async (sessionId: string) => {
    if (!user) return
    await supabase.from('session_players').upsert({
      session_id: sessionId,
      player_id: user.id,
    }, { onConflict: 'session_id,player_id' })
    fetchSessions()
  }

  const statusBadge = (status: string) => {
    const configs: Record<string, { color: string; label: string }> = {
      open: { color: 'bg-blue-500/15 text-blue-400 border-blue-500/25', label: 'Open' },
      voting: { color: 'bg-amber-500/15 text-amber-400 border-amber-500/25', label: 'Voting' },
      completed: { color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25', label: 'Done' },
    }
    const cfg = configs[status] ?? configs.open
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border ${cfg.color}`}>
        <span className="pulse-dot" style={{ background: 'currentColor' }} />
        {cfg.label}
      </span>
    )
  }

  // Find user's squad position in their leagues
  const getMyPosition = (leagueId: string, mySquad: number | null) => {
    if (!mySquad) return null
    const st = leagueStandings.get(leagueId)
    if (!st) return null
    const idx = st.findIndex((s) => s.squad_number === mySquad)
    return idx >= 0 ? idx + 1 : null
  }

  const activeLeagues = myLeagues.filter((l) => l.status === 'active')

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {profile && <Avatar name={profile.display_name} size="xl" />}
          <div>
            <h1 className="text-2xl font-extrabold text-white font-display">Hey, {profile?.display_name?.split(' ')[0]} 👋</h1>
            <p className="text-slate-500 mt-0.5 text-sm">Ready to ball?</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-gold py-2.5 px-5 rounded-xl text-sm uppercase tracking-wide"
        >
          + New Session
        </button>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setShowCreate(true)}
          className="card-hover glass-card rounded-2xl p-5 text-left group relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-xl mb-3">⚽</div>
            <p className="text-white font-bold text-sm">Quick Match</p>
            <p className="text-slate-500 text-xs mt-1 leading-relaxed hidden sm:block">Create & invite</p>
          </div>
        </button>
        <button
          onClick={() => navigate('/leagues')}
          className="card-hover glass-card rounded-2xl p-5 text-left group relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-xl mb-3">🏆</div>
            <p className="text-white font-bold text-sm">Leagues</p>
            <p className="text-slate-500 text-xs mt-1 leading-relaxed hidden sm:block">Championship mode</p>
          </div>
        </button>
        <button
          onClick={() => navigate('/ratings')}
          className="card-hover glass-card rounded-2xl p-5 text-left group relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-xl mb-3">⭐</div>
            <p className="text-white font-bold text-sm">Ratings</p>
            <p className="text-slate-500 text-xs mt-1 leading-relaxed hidden sm:block">Anonymous scores</p>
          </div>
        </button>
      </div>

      {/* My Leagues — standings widget */}
      {activeLeagues.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Your Leagues</h2>
          {activeLeagues.map((league) => {
            const st = leagueStandings.get(league.id)
            const myPos = getMyPosition(league.id, league.my_squad)
            const myColor = league.my_squad ? getSquadColor(league.my_squad) : null
            return (
              <div
                key={league.id}
                className="glass-card rounded-2xl overflow-hidden cursor-pointer card-hover"
                onClick={() => navigate(`/league/${league.id}`)}
              >
                {/* League header bar */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800/50">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🏆</span>
                    <span className="text-white font-bold text-sm">{league.name}</span>
                    <span className="text-slate-500 text-xs">{league.team_size}v{league.team_size}</span>
                  </div>
                  {myColor && (
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${myColor.dot}`} />
                      <span className={`text-xs font-bold ${myColor.text}`}>{myColor.name}</span>
                      {myPos && (
                        <span className="text-xs text-slate-500">
                          {myPos === 1 ? '🥇' : myPos === 2 ? '🥈' : myPos === 3 ? '🥉' : `#${myPos}`}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Mini standings table */}
                {st && st.length > 0 ? (
                  <div className="px-2 py-1">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-500">
                          <th className="text-left font-medium px-3 py-1.5 w-8">#</th>
                          <th className="text-left font-medium px-2 py-1.5">Squad</th>
                          <th className="text-center font-medium px-1.5 py-1.5">P</th>
                          <th className="text-center font-medium px-1.5 py-1.5">W</th>
                          <th className="text-center font-medium px-1.5 py-1.5">D</th>
                          <th className="text-center font-medium px-1.5 py-1.5">L</th>
                          <th className="text-center font-medium px-1.5 py-1.5">GD</th>
                          <th className="text-center font-medium px-1.5 py-1.5 text-amber-400">PTS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {st.map((s, idx) => {
                          const c = getSquadColor(s.squad_number)
                          const isMe = s.squad_number === league.my_squad
                          return (
                            <tr key={s.squad_number} className={isMe ? 'bg-amber-500/5' : ''}>
                              <td className="px-3 py-1.5">
                                <span className={`font-bold ${idx === 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                                </span>
                              </td>
                              <td className="px-2 py-1.5">
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-2 h-2 rounded-full ${c.dot}`} />
                                  <span className={`font-semibold ${isMe ? c.text : 'text-slate-300'}`}>
                                    {c.name}
                                    {isMe && <span className="text-[10px] text-slate-500 ml-1">(you)</span>}
                                  </span>
                                </div>
                              </td>
                              <td className="text-center text-slate-400 px-1.5 py-1.5">{s.played}</td>
                              <td className="text-center text-emerald-400 font-medium px-1.5 py-1.5">{s.won}</td>
                              <td className="text-center text-slate-400 px-1.5 py-1.5">{s.drawn}</td>
                              <td className="text-center text-red-400 px-1.5 py-1.5">{s.lost}</td>
                              <td className="text-center px-1.5 py-1.5">
                                <span className={s.goal_difference > 0 ? 'text-emerald-400' : s.goal_difference < 0 ? 'text-red-400' : 'text-slate-400'}>
                                  {s.goal_difference > 0 ? '+' : ''}{s.goal_difference}
                                </span>
                              </td>
                              <td className="text-center px-1.5 py-1.5">
                                <span className="text-amber-400 font-extrabold">{s.points}</span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="px-5 py-4 text-center">
                    <p className="text-slate-500 text-xs">No matches played yet</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Recent Match Scores */}
      {recentMatches.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Recent Scores</h2>
          <div className="grid gap-2">
            {recentMatches.map((m) => {
              const hc = m.home_squad ? getSquadColor(m.home_squad) : SQUAD_COLORS[0]
              const ac = m.away_squad ? getSquadColor(m.away_squad) : SQUAD_COLORS[1]
              const homeWin = m.team_1_goals > m.team_2_goals
              const awayWin = m.team_2_goals > m.team_1_goals
              return (
                <div
                  key={m.id}
                  className="glass-card rounded-xl px-4 py-3 flex items-center cursor-pointer card-hover"
                  onClick={() => navigate(`/results/${m.id}`)}
                >
                  {/* Home */}
                  <div className="flex items-center gap-1.5 flex-1 justify-end">
                    <span className={`text-sm font-bold ${homeWin ? hc.text : 'text-slate-400'}`}>{hc.name}</span>
                    <div className={`w-2 h-2 rounded-full ${hc.dot}`} />
                  </div>

                  {/* Score */}
                  <div className="flex items-center gap-2 mx-4">
                    <span className={`text-lg font-extrabold tabular-nums ${homeWin ? 'text-white' : 'text-slate-400'}`}>{m.team_1_goals}</span>
                    <span className="text-slate-600 text-xs">—</span>
                    <span className={`text-lg font-extrabold tabular-nums ${awayWin ? 'text-white' : 'text-slate-400'}`}>{m.team_2_goals}</span>
                  </div>

                  {/* Away */}
                  <div className="flex items-center gap-1.5 flex-1">
                    <div className={`w-2 h-2 rounded-full ${ac.dot}`} />
                    <span className={`text-sm font-bold ${awayWin ? ac.text : 'text-slate-400'}`}>{ac.name}</span>
                  </div>

                  <svg className="w-4 h-4 text-slate-700 ml-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Create Session Form */}
      {showCreate && (
        <div className="glass-card border-gold rounded-2xl p-6 relative">
          <button
            type="button"
            onClick={() => setShowCreate(false)}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
          <h2 className="text-lg font-bold text-white mb-1">New Match Session</h2>
          <p className="text-slate-400 text-sm mb-5">Set up a game and invite the squad</p>
          <form onSubmit={createSession} className="space-y-4">
            <div>
              <label className="block text-slate-300 text-xs font-medium mb-1.5 uppercase tracking-wide">Session Name</label>
              <input
                type="text"
                placeholder="e.g. Sunday 5v5, Champions League Night"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-slate-300 text-xs font-medium mb-1.5 uppercase tracking-wide">Pitch Size (players per team)</label>
              <div className="flex gap-2">
                {([5, 6, 8, 11] as const).map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setTeamSize(size)}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
                      teamSize === size
                        ? 'btn-gold'
                        : 'bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700/60'
                    }`}
                  >
                    {size}v{size}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="flex-1 btn-gold py-3 rounded-xl text-sm uppercase tracking-wide"
              >
                Create Session
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-5 py-3 rounded-xl text-slate-400 hover:text-white bg-slate-800/80 border border-slate-700/60 font-medium text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Recent Quick Match Sessions */}
      {loading ? (
        <div className="text-center py-16">
          <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400">Loading...</p>
        </div>
      ) : sessions.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Quick Matches</h2>
          <div className="grid gap-3">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="card-hover glass-card rounded-2xl p-4 flex items-center justify-between cursor-pointer"
                onClick={() => navigate(s.status === 'completed' ? `/results/${s.id}` : `/session/${s.id}`)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/40 flex items-center justify-center text-lg">
                    {s.status === 'completed' ? '✅' : s.status === 'voting' ? '🗳️' : '⚽'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-sm font-bold text-white">{s.name}</h3>
                      {statusBadge(s.status)}
                    </div>
                    <p className="text-slate-500 text-xs">
                      {s.player_count} player{s.player_count !== 1 ? 's' : ''} · {s.team_size}v{s.team_size}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {s.status === 'open' && (
                    <button onClick={() => joinSession(s.id)} className="btn-gold text-xs py-1.5 px-3 rounded-lg">
                      Join
                    </button>
                  )}
                  {s.status === 'voting' && (
                    <button onClick={() => navigate(`/vote/${s.id}`)} className="btn-gold text-xs py-1.5 px-3 rounded-lg">
                      Vote
                    </button>
                  )}
                  <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && sessions.length === 0 && myLeagues.length === 0 && (
        <div className="text-center py-16 bg-slate-900/40 rounded-3xl border border-slate-800/40">
          <div className="text-5xl mb-3">🏟️</div>
          <p className="text-lg text-white font-bold">No sessions yet</p>
          <p className="text-slate-400 text-sm mt-1.5 max-w-xs mx-auto">Create a quick match or start a league to get going</p>
        </div>
      )}
    </div>
  )
}
