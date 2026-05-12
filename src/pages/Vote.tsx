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

  if (loading) return <div className="text-center text-pitch-200 py-12">Loading...</div>

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(`/session/${sessionId}`)} className="text-pitch-200 hover:text-white text-sm">
        ← Back to Session
      </button>

      <div>
        <h1 className="text-3xl font-bold text-white">Rate Players</h1>
        <p className="text-pitch-200 mt-1">
          Rate each player from 1 (beginner) to 10 (pro). Your votes are <span className="text-pitch-100 font-medium">completely anonymous</span>.
        </p>
      </div>

      <div className="space-y-4">
        {targets.map((player) => (
          <div
            key={player.id}
            className="bg-pitch-800 border border-pitch-700 rounded-xl p-5"
          >
            <div className="flex items-center gap-4 mb-3">
              <Avatar name={player.display_name} size="md" />
              <span className="text-white font-medium">{player.display_name}</span>
              {scores[player.id] !== undefined && (
                <span className="ml-auto text-2xl font-bold text-blue-400">
                  {scores[player.id]}
                </span>
              )}
            </div>

            <div className="flex gap-2">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((score) => (
                <button
                  key={score}
                  onClick={() => setScore(player.id, score)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                    scores[player.id] === score
                      ? 'bg-blue-600 text-white scale-105'
                      : 'bg-pitch-700 text-pitch-200 hover:bg-pitch-600 hover:text-white'
                  }`}
                >
                  {score}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={submitVotes}
          disabled={!allVoted || saving}
          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-8 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Submit Votes'}
        </button>
        {!allVoted && (
          <p className="text-pitch-200 text-sm">Rate all players to submit</p>
        )}
        {saved && (
          <p className="text-green-400 text-sm font-medium">✓ Votes saved!</p>
        )}
      </div>
    </div>
  )
}
