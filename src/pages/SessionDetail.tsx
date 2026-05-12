import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Avatar from '../components/Avatar'
import type { Session, Profile } from '../lib/database.types'

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [session, setSession] = useState<Session | null>(null)
  const [players, setPlayers] = useState<(Profile & { has_joined: boolean })[]>([])
  const [isCreator, setIsCreator] = useState(false)
  const [hasJoined, setHasJoined] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    if (!id || !user) return

    const { data: sessionData } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', id)
      .single()

    if (sessionData) {
      setSession(sessionData)
      setIsCreator(sessionData.created_by === user.id)
    }

    const { data: playerData } = await supabase
      .from('session_players')
      .select('player_id, profiles(id, display_name, avatar_url, created_at)')
      .eq('session_id', id)

    if (playerData) {
      const mapped = playerData.map((sp) => ({
        ...(sp.profiles as unknown as Profile),
        has_joined: true,
      }))
      setPlayers(mapped)
      setHasJoined(mapped.some((p) => p.id === user.id))
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id, user])

  const joinSession = async () => {
    if (!id || !user) return
    await supabase.from('session_players').upsert({
      session_id: id,
      player_id: user.id,
    }, { onConflict: 'session_id,player_id' })
    fetchData()
  }

  const leaveSession = async () => {
    if (!id || !user) return
    await supabase
      .from('session_players')
      .delete()
      .eq('session_id', id)
      .eq('player_id', user.id)
    fetchData()
  }

  const startVoting = async () => {
    if (!id) return
    await supabase.from('sessions').update({ status: 'voting' }).eq('id', id)
    fetchData()
  }

  const generateTeams = async () => {
    if (!id) return
    const { error } = await supabase.rpc('generate_teams', { p_session_id: id })
    if (!error) {
      navigate(`/results/${id}`)
    }
  }

  if (loading) return <div className="text-center text-pitch-200 py-12">Loading...</div>
  if (!session) return <div className="text-center text-red-400 py-12">Session not found</div>

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/')} className="text-pitch-200 hover:text-white text-sm">
        ← Back to Sessions
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">{session.name}</h1>
          <p className="text-pitch-200 mt-1">
            Status: <span className="font-medium text-pitch-100">{session.status}</span> · {players.length} players · {session.num_teams} teams
          </p>
        </div>

        {isCreator && session.status === 'open' && players.length >= session.num_teams && (
          <button
            onClick={startVoting}
            className="bg-amber-500 hover:bg-amber-400 text-white font-semibold py-2.5 px-5 rounded-lg transition-colors"
          >
            Start Voting
          </button>
        )}

        {isCreator && session.status === 'voting' && (
          <button
            onClick={generateTeams}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 px-5 rounded-lg transition-colors"
          >
            Generate Teams
          </button>
        )}
      </div>

      {session.status === 'open' && !hasJoined && (
        <button
          onClick={joinSession}
          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 px-5 rounded-lg transition-colors"
        >
          Join This Session
        </button>
      )}

      {session.status === 'open' && hasJoined && !isCreator && (
        <button
          onClick={leaveSession}
          className="bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
        >
          Leave Session
        </button>
      )}

      {session.status === 'voting' && hasJoined && (
        <button
          onClick={() => navigate(`/vote/${id}`)}
          className="bg-yellow-600 hover:bg-yellow-500 text-white font-semibold py-2.5 px-5 rounded-lg transition-colors"
        >
          Go Vote →
        </button>
      )}

      <div>
        <h2 className="text-xl font-semibold text-white mb-4">Players</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {players.map((p) => (
            <div
              key={p.id}
              className="bg-pitch-800/60 border border-pitch-700/40 rounded-xl p-4 text-center hover:bg-pitch-800 transition-colors"
            >
              <div className="mx-auto mb-2.5 flex justify-center">
                <Avatar name={p.display_name} url={p.avatar_url} size="lg" />
              </div>
              <p className="text-white font-medium text-sm truncate">{p.display_name}</p>
              {p.id === user?.id && (
                <span className="text-blue-400 text-xs font-medium">(you)</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
