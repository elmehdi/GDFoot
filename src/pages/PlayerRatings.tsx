import { useRatingReminders } from '../context/RatingRemindersContext'
import { useI18n } from '../context/LanguageContext'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useClubDirectory } from '../context/ClubDirectoryContext'
import Avatar from '../components/Avatar'
import Icon from '../components/Icon'
import SkillRatingFields from '../components/SkillRatingFields'
import FootballCard from '../components/FootballCard'
import { emptySkills, sameSkills, playerSkills, skillLabel, type SkillRatings, type SkillLabels } from '../lib/playerSkills'

export default function PlayerRatings() {
  const { t } = useI18n()

  const { refresh: refreshReminders } = useRatingReminders()
  const { user } = useAuth()
  const { players, playersLoading, playersError, refreshPlayers } = useClubDirectory()
  const [params, setParams] = useSearchParams()
  const [scores, setScores] = useState<Record<string, number>>({})
  const [drafts, setDrafts] = useState<Record<string, number>>({})
  const [skills, setSkills] = useState<Record<string, SkillRatings>>({})
  const [skillDrafts, setSkillDrafts] = useState<Record<string, SkillRatings>>({})
  const [cardLabels, setCardLabels] = useState<Record<string, SkillLabels>>({})
  const [ratingsReady, setRatingsReady] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'unrated' | 'rated'>('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState('')
  const [error, setError] = useState('')
  const listHeadingRef = useRef<HTMLHeadingElement>(null)
  const editorHeadingRef = useRef<HTMLHeadingElement>(null)
  const others = players.filter(player => player.id !== user?.id)
  const selected = players.find(player => player.id === params.get('player')) ?? others[0]
  const self = selected?.id === user?.id
  const draft = selected ? drafts[selected.id] ?? scores[selected.id] : undefined
  const selectedSkills = selected ? skillDrafts[selected.id] ?? skills[selected.id] ?? emptySkills() : emptySkills()
  const dirty = selected && draft !== undefined && (draft !== scores[selected.id] || !sameSkills(selectedSkills, skills[selected.id] ?? emptySkills()))
  const ratedCount = others.filter(player => scores[player.id] !== undefined).length
  const visible = others.filter(player => player.display_name.toLocaleLowerCase().includes(search.toLocaleLowerCase()) && (filter === 'all' || (filter === 'rated') === (scores[player.id] !== undefined)))
  const focusedPlayer = params.has('player') && players.some(player => player.id === params.get('player'))
  const next = others.find(player => player.id !== selected?.id && scores[player.id] === undefined)
  const fetchRatings = async () => {
    if (!user) return
    setLoading(true); setError(''); setRatingsReady(false)
    const [ratings, skillRatings, labels] = await Promise.all([supabase.from('player_ratings').select('target_id, score').eq('voter_id', user.id), supabase.from('player_skill_ratings').select('*').eq('voter_id', user.id), supabase.rpc('get_player_card_labels')])
    const { data, error: issue } = ratings
    if (issue) setError(t("Could not load your ratings. Please try again."))
    else setScores(Object.fromEntries((data ?? []).map(row => [row.target_id, row.score])))
    if (skillRatings.error) setError(t('Card skills could not be loaded. Please apply migration 024 and try again.'))
    else setSkills(Object.fromEntries((skillRatings.data ?? []).map(row => [row.target_id, row])))
    if (!labels.error) setCardLabels(Object.fromEntries((labels.data ?? []).map(row => [row.target_id, row])))
    setRatingsReady(!issue && !skillRatings.error)
    setLoading(false)
  }
  useEffect(() => { void fetchRatings(); void refreshPlayers() }, [user?.id])
  const selectPlayer = (id?: string) => {
    setParams(previous => {
      const updated = new URLSearchParams(previous)
      if (id) updated.set('player', id)
      else updated.delete('player')
      return updated
    })
    setSavedId('')
    if (window.matchMedia('(max-width: 700px)').matches) window.requestAnimationFrame(() => {
      window.scrollTo(0, 0)
      const heading = id ? editorHeadingRef : listHeadingRef
      heading.current?.focus({ preventScroll: true })
    })
  }
  const choose = (id: string) => selectPlayer(id)
  const skip = () => {
    if (!selected) return
    setDrafts(previous => {
      const updated = { ...previous }
      delete updated[selected.id]
      return updated
    })
    setSkillDrafts(previous => { const updated = { ...previous }; delete updated[selected.id]; return updated })
    if (next) choose(next.id)
    else selectPlayer()
  }
  const save = async (advance = false) => {
    if (!user || !selected || self || draft === undefined || saving || !ratingsReady) return
    const targetId = selected.id
    setSaving(true); setError(''); setSavedId('')
    const savedSkills = { ...selectedSkills }
    const { error: issue } = await supabase.rpc('save_player_card_rating', { p_target_id: targetId, p_score: draft, p_skills: savedSkills })
    if (issue) setError(t("Could not save your rating. Your selection is kept; try again."))
    else {
      setScores(previous => ({ ...previous, [targetId]: draft }))
      setSkills(previous => ({ ...previous, [targetId]: savedSkills }))
      setSavedId(targetId)
      void refreshReminders()
      if (advance && next) choose(next.id)
    }
    setSaving(false)
  }
  return <div className={'page-stack ratings-page' + (focusedPlayer ? ' is-rating' : '')}>
    <div className="page-heading"><div><p className="overline">{t("YOUR PRIVATE NOTEBOOK")}</p><h1>{t("Know the players.")}<br /><em>{t("Balance the game.")}</em></h1><p>{t("Pick a player. Rate their overall level. Edit your rating whenever you want.")}</p></div><span className="privacy-pill"><Icon name="star" size={16} />{t("Only your ratings are visible")}</span></div>
    <div className="ratings-summary"><div><strong>{ratedCount}<span> / {others.length}</span></strong><p>{t("players rated by you")}</p></div><div className="ratings-summary-copy"><b>{t("A fair game starts here.")}</b><p>{t("Your ratings help balance teams. Combined scores are never displayed.")}</p><div className="attendance-track"><span style={{ width: (others.length ? ratedCount / others.length * 100 : 0) + '%' }} /></div></div></div>
    {(error || playersError) && <div className="form-error" role="alert">{error || playersError}<button className="text-link" onClick={() => { void fetchRatings(); void refreshPlayers() }}>{t("Try again")}</button></div>}
    {loading || playersLoading ? <div className="empty-state"><div className="loading-ring" /><p>{t("Loading your ratings...")}</p></div> : <div className={'ratings-workspace' + (focusedPlayer ? ' has-player' : '')}>
      <section className="club-panel rating-player-browser"><div className="section-heading"><h2 ref={listHeadingRef} tabIndex={-1}>{t("The players")}</h2><span className="count-bubble">{others.length}</span></div><label className="search-box"><Icon name="search" size={17} /><input placeholder={t("Find a player...")} aria-label={t("Search players to rate")} value={search} onChange={event => setSearch(event.target.value)} /></label><div className="filter-tabs rating-filters">{(['all', 'unrated', 'rated'] as const).map(value => <button key={value} aria-pressed={filter === value} className={filter === value ? 'selected' : ''} onClick={() => setFilter(value)}>{value === 'all' ? t("All") : value === 'unrated' ? t("To rate") : t("Rated")}</button>)}</div><div className="rating-player-list">{visible.map(player => <button key={player.id} className={'rating-player-choice ' + (selected?.id === player.id ? 'selected' : '')} aria-pressed={selected?.id === player.id} onClick={() => choose(player.id)}><Avatar name={player.display_name} size="sm" /><span><strong>{player.display_name}</strong><small>{drafts[player.id] !== undefined && drafts[player.id] !== scores[player.id] ? t("Unsaved selection") : scores[player.id] !== undefined ? t("Your rating") : t("Not rated yet")}</small></span><b>{scores[player.id] ?? '—'}{scores[player.id] !== undefined && <small>/10</small>}</b><Icon name="arrow" size={16} /></button>)}{!visible.length && <div className="empty-state"><p>{search ? t("No players match that name.") : filter === 'unrated' ? t("Everyone is rated. Nice work!") : t("No players here yet.")}</p>{(search || filter !== 'all') && <button className="text-link" onClick={() => { setSearch(''); setFilter('all') }}>{t("Show all players")}</button>}</div>}</div></section>
      <section className="rating-editor" aria-label={t("Your player rating")}>
        {selected ? <><button className="text-link rating-change-player" disabled={saving} onClick={() => selectPlayer()}><Icon name="back" size={16} />{t('Back to players')}</button><div className="rating-editor-top"><span className="overline">{t("PLAYER PROFILE")}</span><span className="privacy-pill">{t("Private")}</span></div><div className="rating-card-preview"><p className="field-hint">{self ? t('Skill labels from the group') : t('Your skill vote preview')}</p><FootballCard player={selected} own={Boolean(self)} labels={self ? cardLabels[selected.id] : Object.fromEntries(playerSkills.map(({ key }) => [key, skillLabel(key, selectedSkills[key])])) as SkillLabels} /></div><div className="rating-profile"><Avatar name={selected.display_name} size="lg" /><div><h2 ref={editorHeadingRef} tabIndex={-1}>{selected.display_name}</h2><p>{self ? t("Your profile") : t("Your opinion. Your rating.")}</p></div></div>
        {self ? <div className="rating-self"><Icon name="shirt" size={32} /><h3>{t("This is your player profile.")}</h3><p>{t("You cannot rate yourself. Your combined score is private and is never shown.")}</p><Link className="secondary-button" to="/ratings">{t("Rate other players")}<Icon name="arrow" /></Link></div> : <><div className="rating-number"><strong>{draft ?? '—'}</strong><span>/ 10<small>{dirty ? t("Unsaved selection") : t("Your rating")}</small></span></div><h3>{t("How would you rate their overall level?")}</h3><p className="field-hint">{t("Think about technique, teamwork and their impact on the game.")}</p><div className="private-rating-scale" role="group" aria-label={t("Choose a rating from 1 to 10")}>{Array.from({ length: 10 }, (_, i) => i + 1).map(value => <button key={value} aria-label={selected.display_name + ': ' + value + '/10'} aria-pressed={draft === value} className={draft === value ? 'selected' : ''} disabled={saving} onClick={() => { setDrafts(previous => ({ ...previous, [selected.id]: value })); setSavedId('') }}>{value}</button>)}</div><SkillRatingFields value={selectedSkills} disabled={saving} onChange={value => { setSkillDrafts(previous => ({ ...previous, [selected.id]: value })); setSavedId('') }} /><div className="rating-editor-actions rating-desktop-actions"><button className="primary-button" onClick={() => void save()} disabled={!dirty || saving || !ratingsReady}>{saving ? t("Saving...") : t("Save my rating")}<Icon name="check" size={18} /></button>{savedId === selected.id && <span role="status" className="rating-saved"><Icon name="check" size={16} />{t("Rating saved")}</span>}{next && !dirty && scores[selected.id] !== undefined && <button className="text-link" onClick={() => choose(next.id)}>{t("Next player")}<Icon name="arrow" size={16} /></button>}</div><div className="rating-mobile-actions">{dirty && <button className="primary-button" onClick={() => void save(Boolean(next))} disabled={saving || !ratingsReady}>{saving ? t("Saving...") : next ? t("Save & rate next") : t("Save rating")}<Icon name="check" size={18} /></button>}{!dirty && next && scores[selected.id] !== undefined && <button className="primary-button" onClick={() => choose(next.id)}>{t("Rate next")}<Icon name="arrow" size={18} /></button>}{scores[selected.id] === undefined && <button className="secondary-button" disabled={saving} onClick={skip}>{t("Skip for now")}</button>}{savedId === selected.id && <span role="status" className="rating-saved"><Icon name="check" size={16} />{t("Rating saved")}</span>}</div><p className="rating-privacy-note">{t("Your individual votes stay private. Combined skill votes appear as labels on player cards.")}</p></>}
        </> : <div className="empty-state"><Icon name="teams" size={36} /><h2>{t("No other players yet")}</h2><p>{t("Invite your friends to the club. Their profiles will appear here.")}</p><Link to="/matches" className="primary-button">{t("Find a match")}</Link></div>}
      </section>
    </div>}
  </div>
}
