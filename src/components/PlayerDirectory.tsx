import { useI18n } from '../context/LanguageContext'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useClubDirectory } from '../context/ClubDirectoryContext'
import { useAuth } from '../context/AuthContext'
import Avatar from './Avatar'
import Icon from './Icon'

export default function PlayerDirectory({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n()

  const { players, playersLoading, playersError, refreshPlayers } = useClubDirectory()
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const visible = players.filter(player => player.display_name.toLowerCase().includes(search.toLowerCase()))
  return <section className={compact ? 'sidebar-players' : 'club-panel player-directory'} aria-label={compact ? t("Club players sidebar") : t("All club players")}><div className="directory-heading"><span>{compact ? t("THE PLAYERS") : t("All players")}</span><span>{playersLoading ? '...' : players.length}</span></div><label className="search-box"><Icon name="search" size={15} /><input aria-label={compact ? t("Search players in sidebar") : t("Search all players")} placeholder={t("Find a player...")} value={search} onChange={event => setSearch(event.target.value)} /></label>{playersLoading ? <p className="field-hint">{t("Loading players...")}</p> : playersError ? <div role="alert"><p className="field-hint">{playersError}</p><button className="text-link" onClick={refreshPlayers}>{t("Try again")}</button></div> : <div className="directory-list" tabIndex={compact ? 0 : undefined} aria-label={t("Player names")}>{visible.map(player => <Link to={'/ratings?player=' + player.id} key={player.id} className="directory-player"><Avatar name={player.display_name} size={compact ? 'sm' : 'md'} /><strong>{player.display_name}</strong>{player.id === user?.id && <span className="you-badge">{t("YOU")}</span>}</Link>)}{!visible.length && <p className="field-hint">{search ? t("No players match that name.") : t("No players yet.")}</p>}</div>}{compact && <Link to="/players" className="text-link directory-expand">{t("View all players")} <Icon name="arrow" size={14} /></Link>}</section>
}
