import { useI18n } from './context/LanguageContext'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import CreateMatch from './pages/CreateMatch'
import Stadiums from './pages/Stadiums'
import Players from './pages/Players'
import { ClubDirectoryProvider } from './context/ClubDirectoryContext'
import SessionDetail from './pages/SessionDetail'
import { RatingRemindersProvider } from './context/RatingRemindersContext'
import TeamResults from './pages/TeamResults'
import Leagues from './pages/Leagues'
import LeagueDetail from './pages/LeagueDetail'
import PlayerRatings from './pages/PlayerRatings'

function AppRoutes() {
  const { t } = useI18n()
  const { user, loading } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  const returnTo = from && /^\/(session|vote|results|league)\/[^/]+$/.test(from) ? from : '/'

  if (loading) {
    return (
      <div className="min-h-screen bg-pitch-900 flex items-center justify-center">
        <div className="text-pitch-200 text-lg">{t("Loading...")}</div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={returnTo} replace /> : <Login />} />
      <Route element={<ProtectedRoute><ClubDirectoryProvider><RatingRemindersProvider><Layout /></RatingRemindersProvider></ClubDirectoryProvider></ProtectedRoute>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/matches" element={<Dashboard />} />
        <Route path="/matches/new" element={<CreateMatch />} />
        <Route path="/session/:id" element={<SessionDetail />} />
        <Route path="/vote/:id" element={<Navigate to="/ratings" replace />} />
        <Route path="/results/:id" element={<TeamResults />} />
        <Route path="/leagues" element={<Leagues />} />
        <Route path="/league/:id" element={<LeagueDetail />} />
        <Route path="/ratings" element={<PlayerRatings />} />
        <Route path="/stadiums" element={<Stadiums />} />
        <Route path="/players" element={<Players />} />
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
