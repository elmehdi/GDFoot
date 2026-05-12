import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signInWithEmail, signUpWithEmail } = useAuth()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [signUpSuccess, setSignUpSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password, displayName)
        setSignUpSuccess(true)
      } else {
        await signInWithEmail(email, password)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-pitch-900 relative flex items-center justify-center px-4">
      <div className="blob blob-1" />
      <div className="blob blob-2" />

      <div className="max-w-md w-full space-y-8 relative z-10">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 mb-5">
            <span className="text-4xl">⚽</span>
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">G&D Foot</h1>
          <p className="text-slate-400 mt-2">Squad up. Vote. Dominate.</p>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl p-8 border border-slate-800/80">
          {signUpSuccess ? (
            <div className="text-center py-4 space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 mb-2">
                <span className="text-3xl">✉️</span>
              </div>
              <h2 className="text-xl font-bold text-white">Check your email!</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                We sent a confirmation link to <span className="text-white font-medium">{email}</span>.<br />
                Click the link to verify your account, then come back and sign in.
              </p>
              <button
                onClick={() => { setSignUpSuccess(false); setIsSignUp(false); setPassword('') }}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-6 rounded-xl transition-colors text-sm uppercase tracking-wide"
              >
                Go to Sign In
              </button>
            </div>
          ) : (
          <>
          {/* Toggle tabs */}
          <div className="flex bg-slate-800/80 rounded-xl p-1 mb-6">
            <button
              type="button"
              onClick={() => { setIsSignUp(false); setError('') }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                !isSignUp ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsSignUp(true); setError('') }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                isSignUp ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-slate-300 text-xs font-medium mb-1.5 uppercase tracking-wide">Player Name</label>
                <input
                  type="text"
                  placeholder="What should we call you?"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  className="input-field"
                />
                <p className="text-slate-500 text-xs mt-1.5">⚠️ Use your real first name — your teammates need to know who you are when they vote.</p>
              </div>
            )}
            <div>
              <label className="block text-slate-300 text-xs font-medium mb-1.5 uppercase tracking-wide">Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-slate-300 text-xs font-medium mb-1.5 uppercase tracking-wide">Password</label>
              <input
                type="password"
                placeholder="Min. 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="input-field"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl transition-colors disabled:opacity-50 mt-2 text-sm uppercase tracking-wide"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Loading...
                </span>
              ) : isSignUp ? 'Create Account' : 'Let\'s Go'}
            </button>
          </form>
          </>
          )}
        </div>

        <p className="text-center text-slate-500 text-xs">
          Rate your mates anonymously · Build fair teams · No drama
        </p>
      </div>
    </div>
  )
}
