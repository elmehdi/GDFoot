import { useI18n } from '../context/LanguageContext'
import { useRef, useState } from 'react'
import { useClubDirectory } from '../context/ClubDirectoryContext'
import Icon from '../components/Icon'
export default function Stadiums() {
  const { t } = useI18n()

  const { stadiums, stadiumsLoading, stadiumsError, refreshStadiums, addStadium } = useClubDirectory()
  const [name, setName] = useState('')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true); setError(''); setMessage('')
    try { const stadium = await addStadium(name); setName(''); setSearch(''); setMessage(t('{name} is ready to select when you organize a match.', { name: stadium.name })) }
    catch (issue) { setError(issue instanceof Error ? issue.message : t("Could not save the stadium.")) }
    finally { setSaving(false) }
  }
  const visible = stadiums.filter(stadium => stadium.name.toLowerCase().includes(search.toLowerCase()))
  return <div className="page-stack"><div className="page-heading"><div><p className="overline">{t("WHERE WE PLAY")}</p><h1>{t("Our stadiums.")}</h1><p>{t("Save a field’s name once. Choose it whenever you organize a match.")}</p></div><button className="primary-button" onClick={() => input.current?.focus()}><Icon name="plus" size={16} />  {t("Add a stadium")}</button></div><form className="club-panel stadium-add-form" onSubmit={save}><label htmlFor="stadium-name">{t("Stadium name")}</label><div className="stadium-select-row"><input ref={input} id="stadium-name" className="input-field" value={name} onChange={event => setName(event.target.value)} placeholder={t("e.g. Stade Municipal")} maxLength={120} required /><button type="submit" className="primary-button" disabled={saving || !name.trim() || !!stadiumsError || stadiumsLoading}>{saving ? t("Saving...") : t("Save stadium")}</button></div><p className="field-hint">{t("Just the name is enough. You can also add a stadium during match setup.")}</p>{error && <p className="form-error" role="alert">{error}</p>}{message && <p className="success-note" role="status"><Icon name="check" size={16} />{message}</p>}</form><label className="search-box"><Icon name="search" size={16} /><input aria-label={t("Search stadiums")} placeholder={t("Find a stadium...")} value={search} onChange={event => setSearch(event.target.value)} /></label>{stadiumsError ? <div className="empty-state" role="alert"><h2>{t("Stadiums unavailable")}</h2><p>{stadiumsError}</p><button className="secondary-button" onClick={refreshStadiums}>{t("Try again")}</button></div> : stadiumsLoading ? <div className="empty-state"><p>{t("Loading stadiums...")}</p></div> : !visible.length ? <div className="empty-state"><Icon name="pin" size={32} /><h3>{search ? t("No stadiums match that name.") : t("Where does your squad play?")}</h3><p>{search ? t("Try another name or add a new stadium above.") : t("Add your first stadium using the form above.")}</p></div> : <div className="stadium-grid">{visible.map(stadium => <article className="club-panel stadium-card" key={stadium.id}><span className="stadium-icon"><Icon name="pin" size={24} /></span><div><span className="overline">{t("FOOTBALL FIELD")}</span><h2>{stadium.name}</h2></div></article>)}</div>}</div>
}
