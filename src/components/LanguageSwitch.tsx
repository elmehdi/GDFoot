import { useI18n } from '../context/LanguageContext'
export default function LanguageSwitch() {
  const { language, setLanguage } = useI18n()
  return <div className="language-switch" role="group" aria-label="Langue / Language"><button type="button" lang="fr" aria-label="Français" aria-pressed={language === 'fr'} onClick={() => setLanguage('fr')}>FR</button><button type="button" lang="en" aria-label="English" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button></div>
}
