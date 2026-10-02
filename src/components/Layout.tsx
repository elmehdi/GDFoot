import RatingNotifications from './RatingNotifications'
import { useI18n } from '../context/LanguageContext'
import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Avatar from './Avatar'
import Icon from './Icon'
import LanguageSwitch from './LanguageSwitch'
import ThemeSwitch from './ThemeSwitch'
import { useTheme } from '../context/ThemeContext'

const navigation = [
  { path: '/', label: 'Overview', icon: 'home' },
  { path: '/matches', label: 'Matches', icon: 'matches' },
  { path: '/leagues', label: 'Teams & leagues', icon: 'teams' },
  { path: '/ratings', label: 'Player ratings', icon: 'star' },
  { path: '/stadiums', label: 'Stadiums', icon: 'pin' },
  { path: '/players', label: 'Players', icon: 'teams' },
  { path: '/vestiaire', label: 'Locker Room', icon: 'locker' },
] as const

export default function Layout() {
  const { t } = useI18n()
  const { secondsLeft, endTrial } = useTheme()

  const { profile, signOut, updateDisplayName } = useAuth()
  const { pathname } = useLocation()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const active = (path: string) => path === '/' ? pathname === '/' : path === '/matches' ? /^\/(matches|session|vote|results)(\/|$)/.test(pathname) : path === '/leagues' ? /^\/leagues?(\/|$)/.test(pathname) : pathname.startsWith(path)
  const section = pathname === '/faq' ? 'FAQ' : navigation.find(item => active(item.path))?.label ?? t("Overview")
  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    try { await updateDisplayName(name.trim()); setEditing(false) }
    catch { setError(t("Your name could not be saved. Please try again.")) }
    finally { setSaving(false) }
  }
  return <div className="club-app">
    <aside className="club-sidebar">
      <Link to="/" className="club-brand"><span className="brand-mark">Go<span>&amp;</span>Dev</span><span>FOOTBALL CLUB<small>{t("Better sides. Better games.")}</small></span></Link>
      <Link to="/matches/new" className="primary-button sidebar-organize"><Icon name="plus" size={18} />  {t("Organize a match")}</Link>
      <Link to="/matches?filter=open" className="secondary-button sidebar-join"><Icon name="matches" size={18} />  {t("Join a match")}</Link>
      <p className="nav-caption">Go&amp;Dev</p>
      <nav aria-label={t("Main navigation")} className="club-nav">{navigation.map(item => <Link key={item.path} to={item.path} aria-current={active(item.path) ? 'page' : undefined} className={active(item.path) ? 'active' : ''}><Icon name={item.icon} />{t(item.label)}{active(item.path) && <span className="nav-dot" />}</Link>)}</nav>
      <Link to="/faq" aria-current={pathname === '/faq' ? 'page' : undefined} className={'sidebar-faq-link' + (pathname === '/faq' ? ' active' : '')}><Icon name="help" size={19} /><span>FAQ</span><Icon name="arrow" size={15} /></Link>
    </aside>
    <div className="club-workspace">
      <header className="club-topbar"><div className="breadcrumb"><span>Go&amp;Dev</span><span>/</span><strong>{t(section)}</strong></div><Link to="/" className="mobile-brand">Go&amp;Dev <span>FOOT</span></Link><Link to="/pro" state={{ from: pathname }} className="topbar-pro-link"><Icon name="star" size={15} />{t('Go Pro')}<Icon name="arrow" size={14} /></Link><Link to="/faq" className="mobile-faq-link" aria-label="FAQ"><Icon name="help" size={18} />FAQ</Link><div className="topbar-account"><RatingNotifications /><ThemeSwitch /><LanguageSwitch /><button aria-label={t("Edit your profile")} onClick={() => { setName(profile?.display_name ?? ''); setError(''); setEditing(true) }} className="account-button"><Avatar name={profile?.display_name ?? t("Player")} size="sm" /><span>{profile?.display_name ?? t("Player")}</span></button><button aria-label={t("Sign out")} title={t("Sign out")} className="icon-button" onClick={signOut}><Icon name="logout" size={18} /></button></div></header>
      {secondsLeft > 0 && <div className="theme-trial-banner" role="status" aria-live="polite"><span>{t('Light theme trial')} · <strong>{secondsLeft} s</strong></span><button type="button" onClick={endTrial}>{t('End trial')}</button></div>}
      <main className="club-main"><Outlet /></main>
      <footer className="club-footer"><span>Go&Dev FOOTBALL CLUB</span><span>{t("A good game starts with balanced teams.")}</span></footer>
    </div>
    <nav className="mobile-navigation" aria-label={t("Mobile navigation")}>{navigation.map(item => <Link key={item.path} to={item.path} aria-current={active(item.path) ? 'page' : undefined} className={active(item.path) ? 'active' : ''}><Icon name={item.icon} /><span>{item.path === '/leagues' ? t("Teams") : item.path === '/ratings' ? t("Ratings") : t(item.label)}</span></Link>)}</nav>
    {editing && <div className="modal-backdrop" onKeyDown={e => { if (e.key === 'Escape' && !saving) setEditing(false) }}><form className="club-panel profile-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-title" onSubmit={save}><h2 id="profile-title">{t("Your player profile")}</h2><p>{t("This is the name your squad sees.")}</p><label htmlFor="profile-name">{t("Display name")}</label><input id="profile-name" className="input-field" value={name} onChange={e => setName(e.target.value)} autoFocus required />{error && <p role="alert" className="form-error">{error}</p>}<div className="button-row"><button className="primary-button" disabled={saving || !name.trim()}>{saving ? t("Saving...") : t("Save name")}</button><button type="button" className="secondary-button" onClick={() => setEditing(false)}>{t("Cancel")}</button></div></form></div>}
  </div>
}
