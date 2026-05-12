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
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editTeamSize, setEditTeamSize] = useState<5 | 6 | 8 | 11>(5)

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

  const startEditing = () => {
    if (!session) return
    setEditName(session.name)
    setEditTeamSize(session.team_size)
    setEditing(true)
  }

  const saveEdit = async () => {
    if (!id || !editName.trim()) return
    await supabase.from('sessions').update({
      name: editName.trim(),
      team_size: editTeamSize,
    }).eq('id', id)
    setEditing(false)
    fetchData()
  }

  const deleteSession = async () => {
    if (!id) return
    await supabase.from('sessions').delete().eq('id', id)
    navigate('/')
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

  if (loading) return (
    <div className="text-center py-16">
      <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
      <p className="text-slate-400">Loading session...</p>
    </div>
  )
  if (!session) return <div className="text-center text-red-400 py-12">Session not found</div>

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/')} className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        All Sessions
      </button>

      {/* Session header card */}
      <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-6">
        {editing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-slate-300 text-xs font-medium mb-1.5 uppercase tracking-wide">Session Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-slate-300 text-xs font-medium mb-1.5 uppercase tracking-wide">Pitch Size</label>
              <div className="flex gap-2">
                {([5, 6, 8, 11] as const).map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setEditTeamSize(size)}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
                      editTeamSize === size
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700/60'
                    }`}
                  >
                    {size}v{size}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={saveEdit}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-5 rounded-xl transition-colors text-sm uppercase tracking-wide"
              >
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-5 py-2.5 rounded-xl text-slate-400 hover:text-white bg-slate-800/80 border border-slate-700/60 font-medium text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteSession}
                className="ml-auto text-red-400 hover:text-red-300 bg-red-500/10 border border-red-500/20 font-medium py-2.5 px-5 rounded-xl transition-colors text-sm"
              >
                Delete Session
              </button>
            </div>
          </div>
        ) : (
        <>
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-white">{session.name}</h1>
              {isCreator && session.status === 'open' && (
                <button
                  onClick={startEditing}
                  className="text-slate-500 hover:text-white transition-colors p-1"
                  title="Edit session"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
            </div>
            <div className="flex items-center gap-3 mt-2">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border ${
                session.status === 'open' ? 'bg-blue-500/15 text-blue-400 border-blue-500/25' :
                session.status === 'voting' ? 'bg-amber-500/15 text-amber-400 border-amber-500/25' :
                'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
              }`}>
                <span className="pulse-dot" style={{ background: 'currentColor' }} />
                {session.status === 'open' ? 'Open' : session.status === 'voting' ? 'Voting' : 'Complete'}
              </span>
              <span className="text-slate-400 text-sm">{players.length} players · {session.team_size}v{session.team_size}</span>
            </div>
          </div>

          {isCreator && session.status === 'open' && players.length >= session.team_size * 2 && (
            <button
              onClick={startVoting}
              className="bg-amber-500 hover:bg-amber-400 text-white font-bold py-2.5 px-5 rounded-xl transition-colors text-sm uppercase tracking-wide"
            >
              Start Voting
            </button>
          )}

          {isCreator && session.status === 'voting' && (
            <button
              onClick={generateTeams}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-5 rounded-xl transition-colors text-sm uppercase tracking-wide"
            >
              Generate Teams
            </button>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          {session.status === 'open' && !hasJoined && (
            <button
              onClick={joinSession}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-5 rounded-xl transition-colors text-sm"
            >
              Join Session
            </button>
          )}

          {session.status === 'open' && hasJoined && !isCreator && (
            <button
              onClick={leaveSession}
              className="text-red-400 hover:text-red-300 bg-red-500/10 border border-red-500/20 font-medium py-2 px-4 rounded-xl transition-colors text-sm"
            >
              Leave
            </button>
          )}

          {session.status === 'voting' && hasJoined && (
            <button
              onClick={() => navigate(`/vote/${id}`)}
              className="bg-amber-500 hover:bg-amber-400 text-white font-bold py-2.5 px-5 rounded-xl transition-colors text-sm uppercase tracking-wide"
            >
              Go Vote →
            </button>
          )}
        </div>
        </>
        )}
      </div>

      {/* Players grid */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4">Squad ({players.length})</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {players.map((p) => (
            <div
              key={p.id}
              className="card-hover bg-slate-900/60 border border-slate-800/60 rounded-2xl p-4 text-center"
            >
              <div className="mx-auto mb-2.5 flex justify-center">
                <Avatar name={p.display_name} url={p.avatar_url} size="lg" />
              </div>
              <p className="text-white font-semibold text-sm truncate">{p.display_name}</p>
              {p.id === user?.id && (
                <span className="text-blue-400 text-xs font-semibold">(you)</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
