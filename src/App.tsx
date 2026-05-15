import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import SessionDetail from './pages/SessionDetail'
import Vote from './pages/Vote'
import TeamResults from './pages/TeamResults'
import Leagues from './pages/Leagues'
import LeagueDetail from './pages/LeagueDetail'
import PlayerRatings from './pages/PlayerRatings'

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-pitch-900 flex items-center justify-center">
        <div className="text-pitch-200 text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/session/:id" element={<SessionDetail />} />
        <Route path="/vote/:id" element={<Vote />} />
        <Route path="/results/:id" element={<TeamResults />} />
        <Route path="/leagues" element={<Leagues />} />
        <Route path="/league/:id" element={<LeagueDetail />} />
        <Route path="/ratings" element={<PlayerRatings />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
