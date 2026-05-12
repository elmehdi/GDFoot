import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Avatar from '../components/Avatar'

interface TeamMember {
  player_id: string
  team: number
  display_name: string
}

const TEAM_COLORS = [
  { bg: 'bg-blue-500/20', border: 'border-blue-500/40', text: 'text-blue-300', badge: 'bg-blue-600', name: 'Blue' },
  { bg: 'bg-red-500/20', border: 'border-red-500/40', text: 'text-red-300', badge: 'bg-red-600', name: 'Red' },
  { bg: 'bg-yellow-500/20', border: 'border-yellow-500/40', text: 'text-yellow-300', badge: 'bg-yellow-600', name: 'Yellow' },
  { bg: 'bg-purple-500/20', border: 'border-purple-500/40', text: 'text-purple-300', badge: 'bg-purple-600', name: 'Purple' },
]

export default function TeamResults() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [teams, setTeams] = useState<Map<number, TeamMember[]>>(new Map())
  const [sessionName, setSessionName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return

    const fetchResults = async () => {
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('name')
        .eq('id', id)
        .single()

      if (sessionData) setSessionName(sessionData.name)

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

  const activeTeams = Array.from(teams.entries()).filter(([num]) => num > 0)
  const benchPlayers = teams.get(0) ?? []

  if (loading) return (
    <div className="text-center py-16">
      <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
      <p className="text-slate-400">Generating teams...</p>
    </div>
  )

  return (
    <div className="space-y-8">
      <button onClick={() => navigate('/')} className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        All Sessions
      </button>

      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 mb-4">
          <span className="text-3xl">🏆</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white">Teams Ready!</h1>
        <p className="text-slate-400 mt-1">{sessionName}</p>
      </div>

      <div className={`grid gap-5 ${activeTeams.length <= 2 ? 'md:grid-cols-2' : 'md:grid-cols-' + activeTeams.length}`}>
        {activeTeams.map(([teamNum, members]) => {
          const color = TEAM_COLORS[(teamNum - 1) % TEAM_COLORS.length]
          return (
            <div
              key={teamNum}
              className={`${color.bg} border ${color.border} rounded-2xl p-6`}
            >
              <div className="flex items-center justify-between mb-5">
                <span className={`${color.badge} text-white text-xs font-bold px-3 py-1.5 rounded-lg uppercase tracking-wide`}>
                  Team {color.name}
                </span>
                <span className={`${color.text} text-sm font-medium`}>
                  {members.length} players
                </span>
              </div>

              <div className="space-y-2.5">
                {members.map((m) => (
                  <div
                    key={m.player_id}
                    className="flex items-center gap-3 bg-slate-900/40 rounded-xl p-3"
                  >
                    <Avatar name={m.display_name} size="sm" />
                    <span className="text-white font-semibold text-sm">{m.display_name}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {benchPlayers.length > 0 && (
        <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <span className="bg-slate-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg uppercase tracking-wide">
              🪑 Bench
            </span>
            <span className="text-slate-400 text-sm font-medium">
              {benchPlayers.length} {benchPlayers.length === 1 ? 'player' : 'players'}
            </span>
          </div>
          <div className="space-y-2.5">
            {benchPlayers.map((m) => (
              <div
                key={m.player_id}
                className="flex items-center gap-3 bg-slate-900/40 rounded-xl p-3"
              >
                <Avatar name={m.display_name} size="sm" />
                <span className="text-slate-300 font-semibold text-sm">{m.display_name}</span>
              </div>
            ))}
          </div>
          <p className="text-slate-500 text-xs mt-4">
            Substitutes — not enough players for an additional full team.
          </p>
        </div>
      )}

      <div className="text-center bg-slate-900/40 border border-slate-800/40 rounded-xl p-4">
        <p className="text-slate-400 text-sm">
          🔒 Teams balanced by anonymous skill votes. No scores revealed.
        </p>
      </div>
    </div>
  )
}
