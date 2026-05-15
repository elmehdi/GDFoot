import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Avatar from './Avatar'

export default function Layout() {
  const { profile, signOut, updateDisplayName } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [editingName, setEditingName] = useState(false)
  const [newName, setNewName] = useState('')

  const navItems = [
    { path: '/', label: 'Home', icon: '⚽' },
    { path: '/leagues', label: 'Leagues', icon: '🏆' },
    { path: '/ratings', label: 'Ratings', icon: '⭐' },
  ]

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  const handleSaveName = async () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    try {
      await updateDisplayName(trimmed)
      setEditingName(false)
    } catch {
      // ignore
    }
  }

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

          {/* Navigation */}
          <div className="hidden sm:flex items-center gap-1">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive(item.path)
                    ? 'text-amber-400 bg-amber-500/10'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <span className="text-sm">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {profile && (
              <button
                onClick={() => { setEditingName(true); setNewName(profile.display_name) }}
                className="flex items-center gap-2.5 bg-slate-800/60 rounded-full pl-1 pr-3 py-1 border border-slate-700/40 hover:border-amber-500/30 transition-colors"
                title="Click to edit your name"
              >
                <Avatar name={profile.display_name} size="sm" />
                <span className="text-slate-200 text-sm font-medium hidden sm:inline">
                  {profile.display_name}
                </span>
              </button>
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

      {/* Mobile bottom nav */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-pitch-950/95 backdrop-blur-xl border-t border-slate-800/60">
        <div className="flex items-center justify-around py-2">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isActive(item.path)
                  ? 'text-amber-400'
                  : 'text-slate-500'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Edit name modal */}
      {editingName && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="glass-card rounded-2xl p-6 max-w-sm w-full border-gold">
            <h2 className="text-lg font-bold text-white mb-1">Edit Your Name</h2>
            <p className="text-slate-400 text-sm mb-4">This is how teammates see you.</p>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="input-field mb-4"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
            />
            <div className="flex gap-3">
              <button
                onClick={handleSaveName}
                className="flex-1 btn-gold py-2.5 rounded-xl text-sm uppercase tracking-wide"
              >
                Save
              </button>
              <button
                onClick={() => setEditingName(false)}
                className="px-5 py-2.5 rounded-xl text-slate-400 hover:text-white bg-slate-800/80 border border-slate-700/60 font-medium text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-6 py-8 pb-24 sm:pb-8 relative z-10">
        <Outlet />
      </main>
    </div>
  )
}
