import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Avatar from './Avatar'

export default function Layout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-pitch-950 relative">
      <div className="blob blob-1" />
      <div className="blob blob-2" />

      <nav className="sticky top-0 z-50 bg-pitch-950/90 backdrop-blur-xl border-b border-amber-500/10">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2.5 group"
          >
            <img src="/logo.png" alt="Go&Dev" className="h-9 w-auto group-hover:scale-105 transition-transform" />
            <span className="text-lg font-extrabold text-gold tracking-tight font-display">G&D Foot</span>
          </button>

          <div className="flex items-center gap-3">
            {profile && (
              <div className="flex items-center gap-2.5 bg-slate-800/60 rounded-full pl-1 pr-3 py-1 border border-slate-700/40">
                <Avatar name={profile.display_name} size="sm" />
                <span className="text-slate-200 text-sm font-medium hidden sm:inline">
                  {profile.display_name}
                </span>
              </div>
            )}
            <button
              onClick={signOut}
              className="text-slate-400 hover:text-amber-400 text-sm px-3 py-2 rounded-lg hover:bg-slate-800/50 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8 relative z-10">
        <Outlet />
      </main>
    </div>
  )
}
