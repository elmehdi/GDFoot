import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './light.css'
import './vestiaire.css'
import './pickup-games.css'
import './faq.css'
import './mobile-header.css'
import './ratings-mobile.css'
import './match-leave.css'
import './player-cards.css'
import './post-match.css'
import { LanguageProvider } from './context/LanguageContext'
import { ThemeProvider } from './context/ThemeContext'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider><ThemeProvider><App /></ThemeProvider></LanguageProvider>
  </StrictMode>,
)
