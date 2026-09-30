import { useI18n } from '../context/LanguageContext'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { t } = useI18n()

  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen bg-pitch-900 flex items-center justify-center">
        <div className="text-pitch-200 text-lg">{t("Loading...")}</div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />

  return <>{children}</>
}
