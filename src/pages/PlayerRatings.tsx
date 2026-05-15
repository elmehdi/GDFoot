import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Avatar from '../components/Avatar'
import type { Profile } from '../lib/database.types'

interface RatedPlayer extends Profile {
  currentScore: number | null
}

export default function PlayerRatings() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [players, setPlayers] = useState<RatedPlayer[]>([])
  const [scores, setScores] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [unratedCount, setUnratedCount] = useState(0)

  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      // Get all profiles except self
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', user.id)
        .order('display_name')

      // Get my existing ratings
      const { data: myRatings } = await supabase
        .from('player_ratings')
        .select('target_id, score')
        .eq('voter_id', user.id)

      const existingScores: Record<string, number> = {}
      myRatings?.forEach((r) => { existingScores[r.target_id] = r.score })

      if (allProfiles) {
        const mapped = allProfiles.map((p) => ({
          ...p,
          currentScore: existingScores[p.id] ?? null,
        }))
        setPlayers(mapped)
        setScores(existingScores)
        setUnratedCount(mapped.filter((p) => existingScores[p.id] === undefined).length)
      }
      setLoading(false)
    }

    fetchData()
  }, [user])

  const setScore = (playerId: string, score: number) => {
    setScores((prev) => ({ ...prev, [playerId]: score }))
    setSaved(false)
  }

  const saveRatings = async () => {
    if (!user) return
    setSaving(true)

    const ratings = Object.entries(scores).map(([targetId, score]) => ({
      voter_id: user.id,
      target_id: targetId,
      score,
    }))

    const { error } = await supabase
      .from('player_ratings')
      .upsert(ratings, { onConflict: 'voter_id,target_id' })

    setSaving(false)
    if (!error) {
      setSaved(true)
      setUnratedCount(players.filter((p) => scores[p.id] === undefined).length)
    }
  }

  const ratedCount = players.filter((p) => scores[p.id] !== undefined).length

  if (loading) return (
    <div className="text-center py-16">
      <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
      <p className="text-slate-400">Loading players...</p>
    </div>
  )

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/')} className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Home
      </button>

      <div>
        <h1 className="text-2xl font-extrabold text-white font-display">Player Ratings</h1>
        <p className="text-slate-400 mt-1 text-sm">
          Rate each player once. Edit anytime. <span className="text-blue-400 font-medium">100% anonymous</span> — used for balanced team generation.
        </p>
        {unratedCount > 0 && (
          <div className="mt-3 inline-flex items-center gap-2 bg-amber-500/10 text-amber-400 text-xs font-semibold px-3 py-1.5 rounded-lg border border-amber-500/20">
            <span>⚠️</span> {unratedCount} new player{unratedCount > 1 ? 's' : ''} to rate
          </div>
        )}
      </div>

      {players.length === 0 ? (
        <div className="text-center py-20 bg-slate-900/40 rounded-3xl border border-slate-800/40">
          <div className="text-5xl mb-3">👥</div>
          <p className="text-lg text-white font-bold">No other players yet</p>
          <p className="text-slate-400 text-sm mt-1">Once others sign up, you'll be able to rate them here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {players.map((player) => (
            <div
              key={player.id}
              className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-5"
            >
              <div className="flex items-center gap-4 mb-4">
                <Avatar name={player.display_name} size="md" />
                <span className="text-white font-semibold">{player.display_name}</span>
                {scores[player.id] !== undefined && (
                  <span className="ml-auto text-3xl font-black text-blue-400">
                    {scores[player.id]}
                  </span>
                )}
                {scores[player.id] === undefined && player.currentScore === null && (
                  <span className="ml-auto text-xs text-amber-400 font-medium bg-amber-500/10 px-2 py-1 rounded-lg">NEW</span>
                )}
              </div>

              <div className="flex gap-1.5">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((score) => (
                  <button
                    key={score}
                    onClick={() => setScore(player.id, score)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                      scores[player.id] === score
                        ? 'bg-amber-500 text-pitch-950 scale-105'
                        : scores[player.id] !== undefined && score <= scores[player.id]
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {score}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {players.length > 0 && (
        <div className="sticky bottom-6 bg-pitch-950/90 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm">{ratedCount}/{players.length} rated</p>
            {saved && (
              <p className="text-emerald-400 text-sm font-semibold flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                Ratings saved!
              </p>
            )}
          </div>
          <button
            onClick={saveRatings}
            disabled={ratedCount === 0 || saving}
            className="btn-gold py-3 px-8 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed text-sm uppercase tracking-wide"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </span>
            ) : 'Save Ratings'}
          </button>
        </div>
      )}
    </div>
  )
}
