import { useState } from 'react'
import { Link } from 'react-router-dom'
import LanguageSwitch from '../components/LanguageSwitch'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../context/LanguageContext'
import { supabase } from '../lib/supabase'

export default function PasswordRecovery({ mode }: { mode: 'request' | 'reset' }) {
  const { t } = useI18n()
  const { session } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [linkError] = useState(() => new URLSearchParams(window.location.hash.slice(1)).has('error') || new URLSearchParams(window.location.search).has('error'))
  const reset = mode === 'reset'
  const invalid = reset && (!session || linkError)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy || invalid) return
    setError('')
    if (reset && password !== confirmation) {
      setError(t('Passwords do not match.'))
      return
    }
    if (reset && password.length < 6) {
      setError(t('Use at least 6 characters.'))
      return
    }
    setBusy(true)
    try {
      const { error: issue } = reset
        ? await supabase.auth.updateUser({ password })
        : await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` })
      if (issue) {
        setError(t(issue.status === 429 ? 'Too many requests. Please wait before trying again.' : reset ? 'Could not update your password. Try a different password or request a new link.' : 'Could not send the reset email. Please try again later.'))
        return
      }
      setPassword('')
      setConfirmation('')
      setDone(true)
    } catch {
      setError(t('Connection failed. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  return <div className="login-page min-h-screen bg-pitch-950 relative flex items-center justify-center px-4">
    <div className="login-language"><LanguageSwitch /></div>
    <div className="blob blob-1" /><div className="blob blob-2" />
    <div className="max-w-md w-full space-y-8 relative z-10 py-8">
      <h1 className="text-center text-4xl font-extrabold text-gold tracking-tight font-display">Go&Dev Foot</h1>
      <section className="glass-card rounded-3xl p-8 border-gold space-y-5">
        <h2 className="text-xl font-bold text-white">{t(reset ? 'Choose a new password' : 'Reset your password')}</h2>
        {done ? <div role="status" className="space-y-5">
          <p className="text-slate-300 text-sm">{t(reset ? 'Your password has been updated.' : 'If an account exists for this email, we have sent a password reset link. Check your inbox and spam folder.')}</p>
          <Link className="primary-button" to={reset ? '/' : '/login'}>{t(reset ? 'Continue to dashboard' : 'Back to sign in')}</Link>
        </div> : invalid ? <div className="space-y-5">
          <p role="alert" className="text-slate-300 text-sm">{t('This reset link is invalid or has expired. Request a new one below.')}</p>
          <Link className="primary-button" to="/forgot-password">{t('Request a new link')}</Link>
        </div> : <form onSubmit={submit} className="space-y-4">
          {!reset && <p className="text-slate-400 text-sm">{t('Enter your email to receive a password reset link.')}</p>}
          {reset ? <>
            <label className="block text-slate-300 text-sm" htmlFor="new-password">{t('New password')}</label>
            <input id="new-password" className="input-field" type="password" autoComplete="new-password" minLength={6} required value={password} onChange={event => setPassword(event.target.value)} disabled={busy} aria-describedby="password-hint" />
            <p id="password-hint" className="text-slate-400 text-xs">{t('Use at least 6 characters.')}</p>
            <label className="block text-slate-300 text-sm" htmlFor="confirm-password">{t('Confirm new password')}</label>
            <input id="confirm-password" className="input-field" type="password" autoComplete="new-password" minLength={6} required value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} />
          </> : <>
            <label className="block text-slate-300 text-sm" htmlFor="recovery-email">{t('Email')}</label>
            <input id="recovery-email" className="input-field" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} disabled={busy} />
          </>}
          {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
          <button disabled={busy} className="w-full btn-gold py-3.5 rounded-xl disabled:opacity-50 text-sm" type="submit">{t(busy ? 'Loading...' : reset ? 'Save new password' : 'Send reset link')}</button>
          <Link className="text-link block text-center" to="/login">{t('Back to sign in')}</Link>
        </form>}
      </section>
    </div>
  </div>
}
