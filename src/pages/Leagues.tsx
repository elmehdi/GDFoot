import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { League } from '../lib/database.types'

export default function Leagues() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [leagues, setLeagues] = useState<(League & { player_count: number; match_count: number })[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [teamSize, setTeamSize] = useState<5 | 6 | 8 | 11>(5)
  const [loading, setLoading] = useState(true)

  const fetchLeagues = async () => {
    const { data } = await supabase
      .from('leagues')
      .select('*, league_players(count), sessions(count)')
      .order('created_at', { ascending: false })

    if (data) {
      const mapped = data.map((l) => ({
        ...l,
        player_count: (l.league_players as unknown as { count: number }[])[0]?.count ?? 0,
        match_count: (l.sessions as unknown as { count: number }[])[0]?.count ?? 0,
      }))
      setLeagues(mapped)
    }
    setLoading(false)
  }

  useEffect(() => { fetchLeagues() }, [])

  const createLeague = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    const { data, error } = await supabase
      .from('leagues')
      .insert({ name: newName, created_by: user.id, team_size: teamSize })
      .select()
      .single()

    if (!error && data) {
      // Auto-join as player
      await supabase.from('league_players').upsert({
        league_id: data.id,
        player_id: user.id,
      }, { onConflict: 'league_id,player_id' })
      setNewName('')
      setShowCreate(false)
      fetchLeagues()
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white font-display">🏆 Leagues</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Championship mode — track wins, draws, points</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-gold py-2.5 px-5 rounded-xl text-sm uppercase tracking-wide"
        >
          + New League
        </button>
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
          <h2 className="text-lg font-bold text-white mb-1">New League</h2>
          <p className="text-slate-400 text-sm mb-5">Create a championship and invite players</p>
          <form onSubmit={createLeague} className="space-y-4">
            <div>
              <label className="block text-slate-300 text-xs font-medium mb-1.5 uppercase tracking-wide">League Name</label>
              <input
                type="text"
                placeholder="e.g. G&D Champions League, Sunday League"
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
              <button type="submit" className="flex-1 btn-gold py-3 rounded-xl text-sm uppercase tracking-wide">
                Create League
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
          <p className="text-slate-400">Loading leagues...</p>
        </div>
      ) : leagues.length === 0 ? (
        <div className="text-center py-20 bg-slate-900/40 rounded-3xl border border-slate-800/40">
          <div className="text-6xl mb-4">🏆</div>
          <p className="text-xl text-white font-bold">No leagues yet</p>
          <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto">Create a league to track your squad's championship</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-5 btn-gold py-2.5 px-6 rounded-xl text-sm"
          >
            Create First League
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {leagues.map((l) => (
            <div
              key={l.id}
              className="card-hover glass-card rounded-2xl p-5 flex items-center justify-between cursor-pointer"
              onClick={() => navigate(`/league/${l.id}`)}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-xl">
                  🏆
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-0.5">
                    <h3 className="text-base font-bold text-white">{l.name}</h3>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border ${
                      l.status === 'active'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                        : 'bg-slate-500/15 text-slate-400 border-slate-500/25'
                    }`}>
                      <span className="pulse-dot" style={{ background: 'currentColor' }} />
                      {l.status === 'active' ? 'Active' : 'Completed'}
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm">
                    {l.player_count} player{l.player_count !== 1 ? 's' : ''} · {l.match_count} match{l.match_count !== 1 ? 'es' : ''} · {l.team_size}v{l.team_size}
                  </p>
                </div>
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
