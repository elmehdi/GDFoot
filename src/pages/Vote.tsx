import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Avatar from '../components/Avatar'
import type { Profile } from '../lib/database.types'

interface VoteTarget extends Profile {
  currentScore: number | null
}

export default function Vote() {
  const { id: sessionId } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [targets, setTargets] = useState<VoteTarget[]>([])
  const [scores, setScores] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sessionId || !user) return

    const fetchTargets = async () => {
      // Get all players in session except self
      const { data: playerData } = await supabase
        .from('session_players')
        .select('player_id, profiles(id, display_name, avatar_url, created_at)')
        .eq('session_id', sessionId)
        .neq('player_id', user.id)

      // Get my existing votes for this session
      const { data: myVotes } = await supabase
        .from('votes')
        .select('target_id, score')
        .eq('session_id', sessionId)
        .eq('voter_id', user.id)

      const existingScores: Record<string, number> = {}
      myVotes?.forEach((v) => { existingScores[v.target_id] = v.score })

      if (playerData) {
        const mapped = playerData.map((sp) => {
          const profile = sp.profiles as unknown as Profile
          return {
            ...profile,
            currentScore: existingScores[profile.id] ?? null,
          }
        })
        setTargets(mapped)
        setScores(existingScores)
      }
      setLoading(false)
    }

    fetchTargets()
  }, [sessionId, user])

  const setScore = (playerId: string, score: number) => {
    setScores((prev) => ({ ...prev, [playerId]: score }))
    setSaved(false)
  }

  const submitVotes = async () => {
    if (!sessionId || !user) return
    setSaving(true)

    const votes = Object.entries(scores).map(([targetId, score]) => ({
      session_id: sessionId,
      voter_id: user.id,
      target_id: targetId,
      score,
    }))

    // Upsert votes (insert or update)
    const { error } = await supabase
      .from('votes')
      .upsert(votes, { onConflict: 'session_id,voter_id,target_id' })

    setSaving(false)
    if (!error) {
      setSaved(true)
    }
  }

  const allVoted = targets.length > 0 && targets.every((t) => scores[t.id] !== undefined)

  if (loading) return (
    <div className="text-center py-16">
      <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
      <p className="text-slate-400">Loading players...</p>
    </div>
  )

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(`/session/${sessionId}`)} className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to Session
      </button>

      <div>
        <h1 className="text-2xl font-extrabold text-white">Rate Your Squad</h1>
        <p className="text-slate-400 mt-1">
          1 = beginner · 10 = baller. <span className="text-blue-400 font-medium">100% anonymous</span>.
        </p>
      </div>

      <div className="space-y-3">
        {targets.map((player) => (
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
            </div>

            <div className="flex gap-1.5">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((score) => (
                <button
                  key={score}
                  onClick={() => setScore(player.id, score)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    scores[player.id] === score
                      ? 'bg-blue-600 text-white scale-105'
                      : scores[player.id] !== undefined && score <= scores[player.id]
                        ? 'bg-blue-600/20 text-blue-300'
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

      <div className="sticky bottom-6 bg-pitch-950/90 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-4 flex items-center justify-between">
        <div>
          {!allVoted && (
            <p className="text-slate-400 text-sm">{targets.filter(t => scores[t.id] !== undefined).length}/{targets.length} rated</p>
          )}
          {saved && (
            <p className="text-emerald-400 text-sm font-semibold flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
              Votes locked in!
            </p>
          )}
        </div>
        <button
          onClick={submitVotes}
          disabled={!allVoted || saving}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm uppercase tracking-wide"
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving...
            </span>
          ) : 'Submit Votes'}
        </button>
      </div>
    </div>
  )
}
