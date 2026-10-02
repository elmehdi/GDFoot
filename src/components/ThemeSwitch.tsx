import { useI18n } from '../context/LanguageContext'
import { useTheme } from '../context/ThemeContext'
import { useLocation, useNavigate } from 'react-router-dom'

export default function ThemeSwitch() {
  const { language } = useI18n()
  const { theme, endTrial } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const label = theme === 'light'
    ? language === 'fr' ? 'Passer au thème sombre' : 'Switch to dark theme'
    : language === 'fr' ? 'Passer au thème clair' : 'Switch to light theme'

  return <button type="button" className="theme-switch icon-button" onClick={() => theme === 'light' ? endTrial() : navigate('/pro', { state: { from: location.pathname + location.search, fromLightSwitch: true } })} aria-label={label} title={label}>
    {theme === 'light' ? <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.5 14.4A9 9 0 0 1 9.6 3.5 9 9 0 1 0 20.5 14.4Z" /></svg> : <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></svg>}
  </button>
}
