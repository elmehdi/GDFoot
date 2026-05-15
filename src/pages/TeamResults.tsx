import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { toPng } from 'html-to-image'
import Avatar from '../components/Avatar'

interface TeamMember {
  player_id: string
  team: number
  display_name: string
}

const TEAM_COLORS = [
  { bg: 'from-blue-600/20 to-blue-900/10', border: 'border-blue-500/30', text: 'text-blue-300', badge: 'bg-blue-600', dot: 'bg-blue-500', name: 'Blue' },
  { bg: 'from-red-600/20 to-red-900/10', border: 'border-red-500/30', text: 'text-red-300', badge: 'bg-red-600', dot: 'bg-red-500', name: 'Red' },
  { bg: 'from-yellow-600/20 to-yellow-900/10', border: 'border-yellow-500/30', text: 'text-yellow-300', badge: 'bg-yellow-600', dot: 'bg-yellow-500', name: 'Yellow' },
  { bg: 'from-purple-600/20 to-purple-900/10', border: 'border-purple-500/30', text: 'text-purple-300', badge: 'bg-purple-600', dot: 'bg-purple-500', name: 'Purple' },
]

export default function TeamResults() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const teamsRef = useRef<HTMLDivElement>(null)
  const [teams, setTeams] = useState<Map<number, TeamMember[]>>(new Map())
  const [sessionName, setSessionName] = useState('')
  const [leagueId, setLeagueId] = useState<string | null>(null)
  const [isCreator, setIsCreator] = useState(false)
  const [locked, setLocked] = useState(false)
  const [shuffling, setShuffling] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [team1Goals, setTeam1Goals] = useState<number>(0)
  const [team2Goals, setTeam2Goals] = useState<number>(0)
  const [matchResult, setMatchResult] = useState<{ team_1_goals: number; team_2_goals: number } | null>(null)
  const [savingScore, setSavingScore] = useState(false)

  useEffect(() => {
    if (!id) return

    const fetchResults = async () => {
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('name, created_by, locked, league_id')
        .eq('id', id)
        .single()

      if (sessionData) {
        setSessionName(sessionData.name)
        setIsCreator(sessionData.created_by === user?.id)
        setLocked(sessionData.locked ?? false)
        setLeagueId(sessionData.league_id ?? null)
      }

      // Fetch existing match result
      const { data: resultData } = await supabase
        .from('match_results')
        .select('team_1_goals, team_2_goals')
        .eq('session_id', id)
        .maybeSingle()

      if (resultData) {
        setMatchResult(resultData)
        setTeam1Goals(resultData.team_1_goals)
        setTeam2Goals(resultData.team_2_goals)
      }

      const { data: playerData } = await supabase
        .from('session_players')
        .select('player_id, team, profiles(display_name)')
        .eq('session_id', id)
        .not('team', 'is', null)
        .order('team')

      if (playerData) {
        const grouped = new Map<number, TeamMember[]>()
        for (const sp of playerData) {
          const profile = sp.profiles as unknown as { display_name: string }
          const member: TeamMember = {
            player_id: sp.player_id,
            team: sp.team!,
            display_name: profile.display_name,
          }
          const existing = grouped.get(sp.team!) ?? []
          existing.push(member)
          grouped.set(sp.team!, existing)
        }
        setTeams(grouped)
      }
      setLoading(false)
    }

    fetchResults()
  }, [id])

  const shuffleTeams = async () => {
    if (!id) return
    setShuffling(true)
    await supabase.rpc('generate_teams', { p_session_id: id })
    // Re-fetch results
    const { data: playerData } = await supabase
      .from('session_players')
      .select('player_id, team, profiles(display_name)')
      .eq('session_id', id)
      .not('team', 'is', null)
      .order('team')

    if (playerData) {
      const grouped = new Map<number, TeamMember[]>()
      for (const sp of playerData) {
        const profile = sp.profiles as unknown as { display_name: string }
        const member: TeamMember = {
          player_id: sp.player_id,
          team: sp.team!,
          display_name: profile.display_name,
        }
        const existing = grouped.get(sp.team!) ?? []
        existing.push(member)
        grouped.set(sp.team!, existing)
      }
      setTeams(grouped)
    }
    setShuffling(false)
  }

  const saveAndLock = async () => {
    if (!id || !teamsRef.current) return
    setSaving(true)

    // Take screenshot
    try {
      const dataUrl = await toPng(teamsRef.current, {
        backgroundColor: '#060a12',
        pixelRatio: 2,
      })
      // Download the image
      const link = document.createElement('a')
      link.download = `${sessionName || 'teams'}.png`
      link.href = dataUrl
      link.click()
    } catch {
      // Screenshot failed, still lock
    }

    // Lock the session in DB
    await supabase
      .from('sessions')
      .update({ locked: true })
      .eq('id', id)

    setLocked(true)
    setSaving(false)
  }

  const activeTeams = Array.from(teams.entries()).filter(([num]) => num > 0)
  const benchPlayers = teams.get(0) ?? []

  const saveMatchScore = async () => {
    if (!id || !user) return
    setSavingScore(true)

    const { error } = await supabase
      .from('match_results')
      .upsert({
        session_id: id,
        team_1_goals: team1Goals,
        team_2_goals: team2Goals,
        recorded_by: user.id,
      }, { onConflict: 'session_id' })

    if (!error) {
      setMatchResult({ team_1_goals: team1Goals, team_2_goals: team2Goals })
    }
    setSavingScore(false)
  }

  if (loading) return (
    <div className="text-center py-16">
      <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
      <p className="text-slate-400">Generating teams...</p>
    </div>
  )

  return (
    <div className="space-y-8">
      <button onClick={() => leagueId ? navigate(`/league/${leagueId}`) : navigate('/')} className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        {leagueId ? 'Back to League' : 'All Sessions'}
      </button>

      <div className="text-center">
        <h1 className="text-3xl font-extrabold text-gold font-display">Teams Ready!</h1>
        <p className="text-slate-400 mt-1">{sessionName}</p>
        {isCreator && !locked && (
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              onClick={shuffleTeams}
              disabled={shuffling || saving}
              className="inline-flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700 text-amber-400 font-bold py-2.5 px-5 rounded-xl transition-all text-sm border border-amber-500/20 hover:border-amber-500/40 disabled:opacity-50"
            >
              <svg className={`w-4 h-4 ${shuffling ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {shuffling ? 'Shuffling...' : 'Shuffle'}
            </button>
            <button
              onClick={saveAndLock}
              disabled={shuffling || saving}
              className="inline-flex items-center gap-2 btn-gold py-2.5 px-5 rounded-xl text-sm disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {saving ? 'Saving...' : 'Save & Lock'}
            </button>
          </div>
        )}
        {locked && (
          <div className="mt-4 inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-400 text-sm font-semibold px-4 py-2 rounded-xl border border-emerald-500/20">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Teams Locked
          </div>
        )}
      </div>

      <div ref={teamsRef} className="space-y-3">
        {/* Side-by-side teams */}
        <div className="grid grid-cols-2 gap-2 sm:gap-4">
          {activeTeams.map(([teamNum, members]) => {
            const color = TEAM_COLORS[(teamNum - 1) % TEAM_COLORS.length]
            return (
              <div key={teamNum} className="space-y-1.5">
                {/* Team header */}
                <div className="flex items-center gap-1.5 px-1 mb-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${color.dot}`} />
                  <span className="text-white font-bold text-xs uppercase tracking-wider">{color.name}</span>
                </div>

                {/* Players */}
                {members.map((m) => (
                  <div
                    key={m.player_id}
                    className={`flex items-center gap-2 bg-gradient-to-r ${color.bg} border ${color.border} rounded-lg px-2.5 py-2`}
                  >
                    <Avatar name={m.display_name} size="sm" />
                    <span className="text-white font-medium text-xs leading-tight break-all">{m.display_name}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        {/* VS badge centered */}
        {activeTeams.length === 2 && (
          <div className="flex items-center justify-center -mt-1">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
            <span className="px-3 text-[10px] font-black text-amber-500/60 tracking-[0.2em]">MATCH DAY</span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
          </div>
        )}

        {benchPlayers.length > 0 && (
          <div className="pt-2">
            <div className="flex items-center gap-1.5 px-1 mb-2">
              <span className="text-xs">🪑</span>
              <span className="text-slate-400 font-bold text-xs uppercase tracking-wider">Bench</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {benchPlayers.map((m) => (
                <div
                  key={m.player_id}
                  className="flex items-center gap-2 bg-slate-800/50 border border-slate-700/30 rounded-lg px-2.5 py-2"
                >
                  <Avatar name={m.display_name} size="sm" />
                  <span className="text-slate-400 font-medium text-xs leading-tight break-all">{m.display_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="text-center glass-card rounded-xl p-3">
        <p className="text-slate-500 text-[11px]">
          Teams balanced by anonymous skill votes · No scores revealed
        </p>
      </div>

      {/* Match Score Recording */}
      {locked && isCreator && activeTeams.length >= 2 && (
        <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-1 text-center">
            {matchResult ? '📊 Match Result' : '⚽ Record Match Score'}
          </h2>
          <p className="text-slate-400 text-sm text-center mb-5">
            {matchResult ? 'Score has been recorded' : 'Enter the final score after playing'}
          </p>

          <div className="flex items-center justify-center gap-4 sm:gap-8">
            {/* Team 1 */}
            <div className="text-center">
              <div className="flex items-center gap-1.5 justify-center mb-3">
                <div className={`w-2.5 h-2.5 rounded-full ${TEAM_COLORS[0].dot}`} />
                <span className="text-white font-bold text-sm">{TEAM_COLORS[0].name}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTeam1Goals(Math.max(0, team1Goals - 1))}
                  disabled={!!matchResult}
                  className="w-10 h-10 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white font-bold text-lg transition-colors disabled:opacity-40"
                >
                  −
                </button>
                <span className="text-4xl font-black text-blue-400 w-14 text-center">{team1Goals}</span>
                <button
                  onClick={() => setTeam1Goals(team1Goals + 1)}
                  disabled={!!matchResult}
                  className="w-10 h-10 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white font-bold text-lg transition-colors disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>

            <span className="text-2xl font-black text-slate-600">—</span>

            {/* Team 2 */}
            <div className="text-center">
              <div className="flex items-center gap-1.5 justify-center mb-3">
                <div className={`w-2.5 h-2.5 rounded-full ${TEAM_COLORS[1].dot}`} />
                <span className="text-white font-bold text-sm">{TEAM_COLORS[1].name}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTeam2Goals(Math.max(0, team2Goals - 1))}
                  disabled={!!matchResult}
                  className="w-10 h-10 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white font-bold text-lg transition-colors disabled:opacity-40"
                >
                  −
                </button>
                <span className="text-4xl font-black text-red-400 w-14 text-center">{team2Goals}</span>
                <button
                  onClick={() => setTeam2Goals(team2Goals + 1)}
                  disabled={!!matchResult}
                  className="w-10 h-10 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white font-bold text-lg transition-colors disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Result banner */}
          {matchResult && (
            <div className="mt-4 text-center">
              <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border ${
                matchResult.team_1_goals > matchResult.team_2_goals
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                  : matchResult.team_2_goals > matchResult.team_1_goals
                    ? 'bg-red-500/10 text-red-400 border-red-500/20'
                    : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
              }`}>
                {matchResult.team_1_goals > matchResult.team_2_goals
                  ? `${TEAM_COLORS[0].name} Wins!`
                  : matchResult.team_2_goals > matchResult.team_1_goals
                    ? `${TEAM_COLORS[1].name} Wins!`
                    : 'Draw!'}
              </span>
            </div>
          )}

          {!matchResult && (
            <div className="mt-5 text-center">
              <button
                onClick={saveMatchScore}
                disabled={savingScore}
                className="btn-gold py-3 px-8 rounded-xl text-sm uppercase tracking-wide disabled:opacity-50"
              >
                {savingScore ? 'Saving...' : 'Record Score'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Non-creator match result display */}
      {matchResult && !isCreator && (
        <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-5 text-center">
          <p className="text-sm font-bold text-white mb-2">Match Result</p>
          <p className="text-lg">
            <span className="text-blue-400 font-bold">{TEAM_COLORS[0].name} {matchResult.team_1_goals}</span>
            <span className="text-slate-500 mx-3">—</span>
            <span className="text-red-400 font-bold">{matchResult.team_2_goals} {TEAM_COLORS[1].name}</span>
          </p>
        </div>
      )}
    </div>
  )
}
