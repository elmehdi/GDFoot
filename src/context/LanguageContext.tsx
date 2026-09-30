import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { french } from '../lib/translations'

type Language = 'fr' | 'en'
type Translate = (key: string, values?: Record<string, string | number>) => string
const LanguageContext = createContext<{ language: Language; setLanguage: (value: Language) => void; t: Translate } | null>(null)
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => { try { return localStorage.getItem('foot-language') === 'en' ? 'en' : 'fr' } catch { return 'fr' } })
  useEffect(() => { document.documentElement.lang = language; document.title = language === 'fr' ? 'G&D Foot - Des équipes équilibrées' : 'G&D Foot - Balanced teams'; try { localStorage.setItem('foot-language', language) } catch { /* Language still works when storage is unavailable. */ } }, [language])
  const value = useMemo(() => ({ language, setLanguage, t: ((key, values) => {
    let text = language === 'fr' ? french[key] ?? key : key
    if (values) text = text.replace(/\{(\w+)\}/g, (token, name) => String(values[name] ?? token))
    return text
  }) as Translate }), [language])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}
export function useI18n() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('LanguageProvider is required')
  return context
}
