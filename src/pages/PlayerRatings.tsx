import { useI18n } from '../context/LanguageContext'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useClubDirectory } from '../context/ClubDirectoryContext'
import Avatar from '../components/Avatar'
import Icon from '../components/Icon'

export default function PlayerRatings() {
  const { t } = useI18n()

  const { user } = useAuth()
  const { players, playersLoading, playersError, refreshPlayers } = useClubDirectory()
  const [params, setParams] = useSearchParams()
  const [scores, setScores] = useState<Record<string, number>>({})
  const [drafts, setDrafts] = useState<Record<string, number>>({})
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'unrated' | 'rated'>('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState('')
  const [error, setError] = useState('')
  const others = players.filter(player => player.id !== user?.id)
  const selected = players.find(player => player.id === params.get('player')) ?? others[0]
  const self = selected?.id === user?.id
  const draft = selected ? drafts[selected.id] ?? scores[selected.id] : undefined
  const dirty = selected && draft !== undefined && draft !== scores[selected.id]
  const ratedCount = others.filter(player => scores[player.id] !== undefined).length
  const visible = others.filter(player => player.display_name.toLocaleLowerCase().includes(search.toLocaleLowerCase()) && (filter === 'all' || (filter === 'rated') === (scores[player.id] !== undefined)))
  const fetchRatings = async () => {
    if (!user) return
    setLoading(true); setError('')
    const { data, error: issue } = await supabase.from('player_ratings').select('target_id, score').eq('voter_id', user.id)
    if (issue) setError(t("Could not load your ratings. Please try again."))
    else setScores(Object.fromEntries((data ?? []).map(row => [row.target_id, row.score])))
    setLoading(false)
  }
  useEffect(() => { void fetchRatings() }, [user?.id])
  const choose = (id: string) => { setParams({ player: id }); setSavedId('') }
  const save = async () => {
    if (!user || !selected || self || draft === undefined || saving) return
    const targetId = selected.id
    setSaving(true); setError(''); setSavedId('')
    const { error: issue } = await supabase.from('player_ratings').upsert({ voter_id: user.id, target_id: targetId, score: draft, updated_at: new Date().toISOString() }, { onConflict: 'voter_id,target_id' })
    if (issue) setError(t("Could not save your rating. Your selection is kept; try again."))
    else { setScores(previous => ({ ...previous, [targetId]: draft })); setSavedId(targetId) }
    setSaving(false)
  }
  useEffect(() => {
    if (params.has('player') && !loading && !playersLoading && window.matchMedia('(max-width: 700px)').matches) {
      document.querySelector('.rating-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [params.get('player'), loading, playersLoading])
  const next = others.find(player => player.id !== selected?.id && scores[player.id] === undefined)
  return <div className="page-stack ratings-page">
    <div className="page-heading"><div><p className="overline">{t("YOUR PRIVATE NOTEBOOK")}</p><h1>{t("Know the players.")}<br /><em>{t("Balance the game.")}</em></h1><p>{t("Pick a player. Rate their overall level. Edit your rating whenever you want.")}</p></div><span className="privacy-pill"><Icon name="star" size={16} />{t("Only your ratings are visible")}</span></div>
    <div className="ratings-summary"><div><strong>{ratedCount}<span> / {others.length}</span></strong><p>{t("players rated by you")}</p></div><div className="ratings-summary-copy"><b>{t("A fair game starts here.")}</b><p>{t("Your ratings help balance teams. Combined scores are never displayed.")}</p><div className="attendance-track"><span style={{ width: (others.length ? ratedCount / others.length * 100 : 0) + '%' }} /></div></div></div>
    {(error || playersError) && <div className="form-error" role="alert">{error || playersError}<button className="text-link" onClick={() => { void fetchRatings(); void refreshPlayers() }}>{t("Try again")}</button></div>}
    {loading || playersLoading ? <div className="empty-state"><div className="loading-ring" /><p>{t("Loading your ratings...")}</p></div> : <div className={'ratings-workspace ' + (params.has('player') ? 'has-player' : '')}>
      <section className="club-panel rating-player-browser"><div className="section-heading"><h2>{t("The players")}</h2><span className="count-bubble">{others.length}</span></div><label className="search-box"><Icon name="search" size={17} /><input placeholder={t("Find a player...")} aria-label={t("Search players to rate")} value={search} onChange={event => setSearch(event.target.value)} /></label><div className="filter-tabs rating-filters">{(['all', 'unrated', 'rated'] as const).map(value => <button key={value} aria-pressed={filter === value} className={filter === value ? 'selected' : ''} onClick={() => setFilter(value)}>{value === 'all' ? t("All") : value === 'unrated' ? t("To rate") : t("Rated")}</button>)}</div><div className="rating-player-list">{visible.map(player => <button key={player.id} className={'rating-player-choice ' + (selected?.id === player.id ? 'selected' : '')} aria-pressed={selected?.id === player.id} onClick={() => choose(player.id)}><Avatar name={player.display_name} size="sm" /><span><strong>{player.display_name}</strong><small>{drafts[player.id] !== undefined && drafts[player.id] !== scores[player.id] ? t("Unsaved selection") : scores[player.id] !== undefined ? t("Your rating") : t("Not rated yet")}</small></span><b>{scores[player.id] ?? '—'}{scores[player.id] !== undefined && <small>/10</small>}</b><Icon name="arrow" size={16} /></button>)}{!visible.length && <div className="empty-state"><p>{search ? t("No players match that name.") : filter === 'unrated' ? t("Everyone is rated. Nice work!") : t("No players here yet.")}</p>{(search || filter !== 'all') && <button className="text-link" onClick={() => { setSearch(''); setFilter('all') }}>{t("Show all players")}</button>}</div>}</div></section>
      <section className="rating-editor" aria-label={t("Your player rating")}>
        {selected ? <><button className="text-link rating-change-player" onClick={() => document.querySelector('.rating-player-browser')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><Icon name="teams" size={16} />{t('Choose another player')}</button><div className="rating-editor-top"><span className="overline">{t("PLAYER PROFILE")}</span><span className="privacy-pill">{t("Private")}</span></div><div className="rating-profile"><Avatar name={selected.display_name} size="lg" /><div><h2>{selected.display_name}</h2><p>{self ? t("Your profile") : t("Your opinion. Your rating.")}</p></div></div>
        {self ? <div className="rating-self"><Icon name="shirt" size={32} /><h3>{t("This is your player profile.")}</h3><p>{t("You cannot rate yourself. Your combined score is private and is never shown.")}</p><Link className="secondary-button" to="/ratings">{t("Rate other players")}<Icon name="arrow" /></Link></div> : <><div className="rating-number"><strong>{draft ?? '—'}</strong><span>/ 10<small>{dirty ? t("Unsaved selection") : t("Your rating")}</small></span></div><h3>{t("How would you rate their overall level?")}</h3><p className="field-hint">{t("Think about technique, teamwork and their impact on the game.")}</p><div className="private-rating-scale" role="group" aria-label={t("Choose a rating from 1 to 10")}>{Array.from({ length: 10 }, (_, i) => i + 1).map(value => <button key={value} aria-label={selected.display_name + ': ' + value + '/10'} aria-pressed={draft === value} className={draft === value ? 'selected' : ''} disabled={saving} onClick={() => { setDrafts(previous => ({ ...previous, [selected.id]: value })); setSavedId('') }}>{value}</button>)}</div><div className="rating-scale-labels"><span>{t("1–3 · Learning")}</span><span>{t("4–6 · Regular")}</span><span>{t("7–10 · Experienced")}</span></div><div className="rating-editor-actions"><button className="primary-button" onClick={save} disabled={!dirty || saving}>{saving ? t("Saving...") : t("Save my rating")}<Icon name="check" size={18} /></button>{savedId === selected.id && <span role="status" className="rating-saved"><Icon name="check" size={16} />{t("Rating saved")}</span>}{next && !dirty && scores[selected.id] !== undefined && <button className="text-link" onClick={() => choose(next.id)}>{t("Next player")}<Icon name="arrow" size={16} /></button>}</div><p className="rating-privacy-note">{t("Only you can see or edit this rating. Other players cannot see what you gave them.")}</p></>}
        </> : <div className="empty-state"><Icon name="teams" size={36} /><h2>{t("No other players yet")}</h2><p>{t("Invite your friends to the club. Their profiles will appear here.")}</p><Link to="/matches" className="primary-button">{t("Find a match")}</Link></div>}
      </section>
    </div>}
  </div>
}
