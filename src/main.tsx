import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { LanguageProvider } from './context/LanguageContext'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider><App /></LanguageProvider>
  </StrictMode>,
)
