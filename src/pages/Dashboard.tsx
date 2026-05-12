import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Avatar from '../components/Avatar'
import type { Session } from '../lib/database.types'

export default function Dashboard() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<(Session & { player_count: number })[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [numTeams, setNumTeams] = useState(2)
  const [loading, setLoading] = useState(true)

  const fetchSessions = async () => {
    const { data } = await supabase
      .from('sessions')
      .select('*, session_players(count)')
      .order('created_at', { ascending: false })

    if (data) {
      const mapped = data.map((s) => ({
        ...s,
        player_count: (s.session_players as unknown as { count: number }[])[0]?.count ?? 0,
      }))
      setSessions(mapped)
    }
    setLoading(false)
  }

  useEffect(() => { fetchSessions() }, [])

  const createSession = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    const { data, error } = await supabase
      .from('sessions')
      .insert({ name: newName, created_by: user.id, num_teams: numTeams })
      .select()
      .single()

    if (!error && data) {
      // Auto-join as player
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
    const configs: Record<string, { color: string; icon: string; label: string }> = {
      open: { color: 'bg-blue-500/15 text-blue-400 border-blue-500/25', icon: '●', label: 'Open' },
      voting: { color: 'bg-amber-500/15 text-amber-400 border-amber-500/25', icon: '●', label: 'Voting' },
      completed: { color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25', icon: '✓', label: 'Done' },
    }
    const cfg = configs[status] ?? configs.open
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border ${cfg.color}`}>
        <span className="pulse-dot" style={{ background: 'currentColor' }} />
        {cfg.label}
      </span>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {profile && <Avatar name={profile.display_name} url={profile.avatar_url} size="xl" />}
          <div>
            <h1 className="text-2xl font-bold text-white">Welcome back</h1>
            <p className="text-pitch-300 mt-0.5">
              {profile?.display_name} · Ready to play?
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 px-5 rounded-lg transition-colors"
        >
          + New Session
        </button>
      </div>

      {showCreate && (
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 relative">
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
              <label className="block text-slate-300 text-xs font-medium mb-1.5 uppercase tracking-wide">Teams</label>
              <div className="flex gap-2">
                {[2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNumTeams(n)}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
                      numTeams === n
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700/60'
                    }`}
                  >
                    {n} Teams
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-colors text-sm uppercase tracking-wide"
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

      {loading ? (
        <div className="text-center text-pitch-300 py-16">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Loading sessions...
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16 bg-pitch-800/40 rounded-2xl border border-pitch-700/30">
          <div className="text-5xl mb-4">🏟️</div>
          <p className="text-xl text-white font-medium">No sessions yet</p>
          <p className="text-pitch-300 text-sm mt-1">Create one to get the squad together!</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {sessions.map((s) => (
            <div
              key={s.id}
              className="card-hover bg-slate-900/60 border border-slate-800/60 rounded-2xl p-5 flex items-center justify-between cursor-pointer"
              onClick={() => navigate(s.status === 'completed' ? `/results/${s.id}` : `/session/${s.id}`)}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-xl">
                  {s.status === 'completed' ? '🏆' : s.status === 'voting' ? '🗳️' : '⚽'}
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-0.5">
                    <h3 className="text-base font-bold text-white">{s.name}</h3>
                    {statusBadge(s.status)}
                  </div>
                  <p className="text-slate-400 text-sm">
                    {s.player_count} player{s.player_count !== 1 ? 's' : ''} · {s.num_teams} teams
                  </p>
                </div>
              </div>
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                {s.status === 'open' && (
                  <button
                    onClick={() => joinSession(s.id)}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2 px-4 rounded-lg transition-colors uppercase tracking-wide"
                  >
                    Join
                  </button>
                )}
                {s.status === 'voting' && (
                  <button
                    onClick={() => navigate(`/vote/${s.id}`)}
                    className="bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold py-2 px-4 rounded-lg transition-colors uppercase tracking-wide"
                  >
                    Vote
                  </button>
                )}
              </div>
              <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
