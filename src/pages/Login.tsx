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
    <div className="min-h-screen bg-pitch-950 relative flex items-center justify-center px-4">
      <div className="blob blob-1" />
      <div className="blob blob-2" />

      <div className="max-w-md w-full space-y-8 relative z-10">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-gold tracking-tight font-display">G&D Foot</h1>
          <p className="text-slate-400 mt-2 text-sm tracking-wide uppercase">Squad up · Vote · Dominate</p>
        </div>

        <div className="glass-card rounded-3xl p-8 border-gold shine-effect">
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
                className="btn-gold py-2.5 px-6 rounded-xl text-sm uppercase tracking-wide"
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
                !isSignUp ? 'btn-gold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsSignUp(true); setError('') }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                isSignUp ? 'btn-gold' : 'text-slate-400 hover:text-white'
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
                  placeholder="What should we call you? e.g. Zahouani, Casawi"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  className="input-field"
                />
                <p className="text-slate-500 text-xs mt-1.5">⚠️ Use your real name or nickname — teammates need to recognize you.</p>
              </div>
            )}
            <div>
              <label className="block text-slate-300 text-xs font-medium mb-1.5 uppercase tracking-wide">Email</label>
              <input
                type="email"
                placeholder="goandev@example.com"
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
              className="w-full btn-gold py-3.5 rounded-xl disabled:opacity-50 mt-2 text-sm uppercase tracking-wide"
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
