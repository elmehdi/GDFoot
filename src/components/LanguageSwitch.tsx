import Icon from './Icon'
﻿import { useI18n } from '../context/LanguageContext'

export default function LanguageSwitch() {
  const { language, setLanguage } = useI18n()
  return <div className="language-switch" role="group" aria-label="Langue / Language">
    <span className="translation-indicator" title="Traduction / Translation"><Icon name="translate" size={18} /></span><div className="language-options">
      <button type="button" lang="fr" aria-label="Français" title="Français" aria-pressed={language === 'fr'} onClick={() => setLanguage('fr')}><span>FR</span></button>
      <span className="language-divider" aria-hidden="true">|</span>
      <button type="button" lang="en" aria-label="English" title="English" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}><span>EN</span></button>
    </div>
  </div>
}
