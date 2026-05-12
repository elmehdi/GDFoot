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
  const [showHowItWorks, setShowHowItWorks] = useState(false)
  const [newName, setNewName] = useState('')
  const [teamSize, setTeamSize] = useState<5 | 6 | 8 | 11>(5)
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
      .insert({ name: newName, created_by: user.id, team_size: teamSize })
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

      {/* How it works */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowHowItWorks(!showHowItWorks)}
          className="w-full flex items-center justify-between px-5 py-3.5 text-left group"
        >
          <span className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <span className="text-base">💡</span> How it works
          </span>
          <svg className={`w-4 h-4 text-slate-500 transition-transform ${showHowItWorks ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showHowItWorks && (
          <div className="px-5 pb-5 space-y-3 border-t border-slate-800/50 pt-4">
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 text-xs font-bold shrink-0">1</div>
              <div>
                <p className="text-white text-sm font-medium">Create a session & pick pitch size</p>
                <p className="text-slate-400 text-xs mt-0.5">Choose 5v5, 6v6, 8v8, or 11v11 — this sets how many players per team.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 text-xs font-bold shrink-0">2</div>
              <div>
                <p className="text-white text-sm font-medium">Players join the session</p>
                <p className="text-slate-400 text-xs mt-0.5">Share the session with your squad. Everyone signs up and joins.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 text-xs font-bold shrink-0">3</div>
              <div>
                <p className="text-white text-sm font-medium">Rate each player anonymously (1–10)</p>
                <p className="text-slate-400 text-xs mt-0.5">No one sees individual scores — ever. Only the algorithm uses them.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-bold shrink-0">4</div>
              <div>
                <p className="text-white text-sm font-medium">Balanced teams are generated</p>
                <p className="text-slate-400 text-xs mt-0.5">Teams have exactly the pitch size. If there are extra players, the lowest-rated go to the bench — no drama, no arguments.</p>
              </div>
            </div>
          </div>
        )}
      </div>

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

      {loading ? (
        <div className="text-center py-16">
          <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400">Loading sessions...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-20 bg-slate-900/40 rounded-3xl border border-slate-800/40">
          <div className="text-6xl mb-4">🏟️</div>
          <p className="text-xl text-white font-bold">No sessions yet</p>
          <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto">Create a match session and get the squad together</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-5 btn-gold py-2.5 px-6 rounded-xl text-sm"
          >
            Create First Session
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {sessions.map((s) => (
            <div
              key={s.id}
              className="card-hover glass-card rounded-2xl p-5 flex items-center justify-between cursor-pointer"
              onClick={() => navigate(s.status === 'completed' ? `/results/${s.id}` : `/session/${s.id}`)}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700/40 flex items-center justify-center text-xl">
                  {s.status === 'completed' ? '🏆' : s.status === 'voting' ? '🗳️' : '⚽'}
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-0.5">
                    <h3 className="text-base font-bold text-white">{s.name}</h3>
                    {statusBadge(s.status)}
                  </div>
                  <p className="text-slate-400 text-sm">
                    {s.player_count} player{s.player_count !== 1 ? 's' : ''} · {s.team_size}v{s.team_size}
                  </p>
                </div>
              </div>
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                {s.status === 'open' && (
                  <button
                    onClick={() => joinSession(s.id)}
                    className="btn-gold text-xs py-2 px-4 rounded-lg uppercase tracking-wide"
                  >
                    Join
                  </button>
                )}
                {s.status === 'voting' && (
                  <button
                    onClick={() => navigate(`/vote/${s.id}`)}
                    className="btn-gold text-xs py-2 px-4 rounded-lg uppercase tracking-wide"
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
