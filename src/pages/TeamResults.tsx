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

  if (loading) return <div className="text-center text-pitch-200 py-12">Loading results...</div>

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/')} className="text-pitch-200 hover:text-white text-sm">
        ← Back to Sessions
      </button>

      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-2">⚽ Teams Ready!</h1>
        <p className="text-pitch-200 text-lg">{sessionName}</p>
      </div>

      <div className={`grid gap-6 ${teams.size <= 2 ? 'md:grid-cols-2' : 'md:grid-cols-' + teams.size}`}>
        {Array.from(teams.entries()).map(([teamNum, members]) => {
          const color = TEAM_COLORS[(teamNum - 1) % TEAM_COLORS.length]
          return (
            <div
              key={teamNum}
              className={`${color.bg} border ${color.border} rounded-2xl p-6`}
            >
              <div className="flex items-center gap-3 mb-5">
                <span className={`${color.badge} text-white text-sm font-bold px-3 py-1 rounded-full`}>
                  Team {color.name}
                </span>
                <span className={`${color.text} text-sm`}>
                  {members.length} player{members.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="space-y-3">
                {members.map((m) => (
                  <div
                    key={m.player_id}
                    className="flex items-center gap-3 bg-pitch-800/50 rounded-lg p-3"
                  >
                    <Avatar name={m.display_name} size="sm" />
                    <span className="text-white font-medium">{m.display_name}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="text-center">
        <p className="text-pitch-200 text-sm">
          Teams were balanced using anonymous skill ratings. No individual scores are revealed.
        </p>
      </div>
    </div>
  )
}
