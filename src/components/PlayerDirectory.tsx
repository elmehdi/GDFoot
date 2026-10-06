import { useI18n } from '../context/LanguageContext'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useClubDirectory } from '../context/ClubDirectoryContext'
import { useAuth } from '../context/AuthContext'
import Avatar from './Avatar'
import Icon from './Icon'
import FootballCard from './FootballCard'
import { supabase } from '../lib/supabase'
import type { SkillLabels } from '../lib/playerSkills'

export default function PlayerDirectory({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n()

  const { players, playersLoading, playersError, refreshPlayers } = useClubDirectory()
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [labels, setLabels] = useState<Record<string, SkillLabels>>({})
  const [labelsLoading, setLabelsLoading] = useState(!compact)
  const [labelsError, setLabelsError] = useState(false)
  const loadLabels = async () => {
    if (compact || !user) return
    setLabelsLoading(true)
    const { data, error } = await supabase.rpc('get_player_card_labels')
    setLabelsError(Boolean(error))
    if (!error) setLabels(Object.fromEntries((data ?? []).map(row => [row.target_id, row])))
    setLabelsLoading(false)
  }
  useEffect(() => { void loadLabels() }, [compact, user?.id])
  const visible = players.filter(player => player.display_name.toLowerCase().includes(search.toLowerCase()))
  if (!compact) return <section className="player-card-directory" aria-label={t('All club players')}>
    <div className="player-card-toolbar"><label className="search-box"><Icon name="search" size={17} /><input aria-label={t('Search all players')} placeholder={t('Find a player...')} value={search} onChange={event => setSearch(event.target.value)} /></label><span className="count-bubble">{visible.length}</span></div>
    {labelsError && <div className="form-error" role="alert">{t('Card skills could not be loaded. You can still open a player to rate them.')} <button className="text-link" onClick={() => void loadLabels()}>{t('Try again')}</button></div>}
    {playersLoading || labelsLoading ? <div className="empty-state"><div className="loading-ring" /><p>{t('Loading players...')}</p></div> : playersError ? <div className="form-error" role="alert">{playersError}<button className="text-link" onClick={() => void refreshPlayers()}>{t('Try again')}</button></div> : <div className="football-card-grid">{visible.map(player => <Link className="football-card-link" to={'/ratings?player=' + player.id} key={player.id} aria-label={t('Open the card for {name}', { name: player.display_name })}><FootballCard player={player} labels={labels[player.id]} own={player.id === user?.id} /><span className="football-card-link-caption">{player.id === user?.id ? t('Your player card') : t('Rate this player')}<Icon name="arrow" size={16} /></span></Link>)}</div>}
    {!playersLoading && !labelsLoading && !playersError && !visible.length && <div className="empty-state"><p>{search ? t('No players match that name.') : t('No players yet.')}</p></div>}
  </section>
  return <section className={compact ? 'sidebar-players' : 'club-panel player-directory'} aria-label={compact ? t("Club players sidebar") : t("All club players")}><div className="directory-heading"><span>{compact ? t("THE PLAYERS") : t("All players")}</span><span>{playersLoading ? '...' : players.length}</span></div><label className="search-box"><Icon name="search" size={15} /><input aria-label={compact ? t("Search players in sidebar") : t("Search all players")} placeholder={t("Find a player...")} value={search} onChange={event => setSearch(event.target.value)} /></label>{playersLoading ? <p className="field-hint">{t("Loading players...")}</p> : playersError ? <div role="alert"><p className="field-hint">{playersError}</p><button className="text-link" onClick={refreshPlayers}>{t("Try again")}</button></div> : <div className="directory-list" tabIndex={compact ? 0 : undefined} aria-label={t("Player names")}>{visible.map(player => <Link to={'/ratings?player=' + player.id} key={player.id} className="directory-player"><Avatar name={player.display_name} size={compact ? 'sm' : 'md'} /><strong>{player.display_name}</strong>{player.id === user?.id && <span className="you-badge">{t("YOU")}</span>}</Link>)}{!visible.length && <p className="field-hint">{search ? t("No players match that name.") : t("No players yet.")}</p>}</div>}{compact && <Link to="/players" className="text-link directory-expand">{t("View all players")} <Icon name="arrow" size={14} /></Link>}</section>
}
