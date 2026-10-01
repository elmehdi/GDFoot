import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useI18n } from '../context/LanguageContext'
import type { Profile } from '../lib/database.types'
import Icon from './Icon'
import Avatar from './Avatar'

type Group = { id: string; player_ids: string[] }
export default function MatchSeparations({ matchId, players, disabled, onPendingChange }: {
  matchId: string; players: Profile[]; disabled: boolean; onPendingChange: (pending: boolean) => void
}) {
  const { t } = useI18n()
  const [groups, setGroups] = useState<Group[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const playerIds = players.map(player => player.id).sort().join(',')
  const chosen = selected.filter(id => players.some(player => player.id === id))
  const load = async () => {
    setLoading(true); setError('')
    const { data, error: issue } = await supabase.from('match_separation_groups').select('id, player_ids').eq('session_id', matchId)
    if (issue) setError('Could not load player separations. Please try again.')
    else setGroups(data ?? [])
    setLoading(false)
  }
  useEffect(() => { void load() }, [matchId, playerIds])
  const exists = groups.some(group => [...group.player_ids].sort().join(',') === [...chosen].sort().join(','))
  const save = async (removeId?: string) => {
    if (disabled || saving || (!removeId && (chosen.length < 2 || exists))) return
    setSaving(true); onPendingChange(true); setError('')
    try {
      const { data, error: issue } = await supabase.rpc('save_separation_group', { p_session_id: matchId, p_player_ids: removeId ? [] : chosen, ...(removeId ? { p_remove_id: removeId } : {}) })
      if (issue || !data) throw issue
      if (removeId) setGroups(previous => previous.filter(group => group.id !== removeId))
      else { setGroups(previous => [...previous.filter(group => group.id !== data), { id: data, player_ids: chosen }]); setSelected([]); setSearch('') }
    } catch { setError('Could not save this separation. Please try again.') }
    finally { setSaving(false); onPendingChange(false) }
  }
  const name = (id: string) => players.find(player => player.id === id)?.display_name ?? t('Player')
  const visible = players.filter(player => player.display_name.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
  return <details id="match-separations" className="separation-panel">
    <summary>{t('Keep players on different teams')}<span className="count-bubble">{groups.length}</span></summary>
    <p className="field-hint">{t('Select two, three or more players. Every player in a group must be on a different team. Only you can see these settings.')}</p>
    <p className="field-hint">{t('If there are fewer teams than selected players, an existing bench place may be needed. Impossible groups block generation.')}</p>
    {loading ? <p className="field-hint">{t('Loading...')}</p> : <>
      {groups.length > 0 && <ul className="separation-list">{groups.map(group => <li key={group.id}><span>{group.player_ids.map(name).join(' · ')}</span><button type="button" className="icon-button" aria-label={t('Remove group: {names}', { names: group.player_ids.map(name).join(', ') })} disabled={disabled || saving} onClick={() => save(group.id)}><Icon name="close" size={16} /></button></li>)}</ul>}
      <label className="search-box separation-search"><Icon name="search" size={15} /><input aria-label={t('Find a player...')} placeholder={t('Find a player...')} value={search} onChange={event => setSearch(event.target.value)} /></label>
      <fieldset className="separation-choices" disabled={disabled || saving}>
        <legend>{t('Select players to separate')}</legend>
        <div className="separation-card-grid">{visible.map(player => {
          const isSelected = chosen.includes(player.id)
          return <button type="button" key={player.id} className={'separation-player-card' + (isSelected ? ' is-selected' : '')} aria-label={player.display_name} aria-pressed={isSelected} onClick={() => setSelected(previous => previous.includes(player.id) ? previous.filter(id => id !== player.id) : [...previous, player.id])}>
            <Avatar name={player.display_name} size="sm" />
            <span className="separation-player-name">{player.display_name}</span>
            <span className="separation-card-mark"><Icon name={isSelected ? 'check' : 'plus'} size={14} /></span>
          </button>
        })}</div>
        {!visible.length && <p className="field-hint">{t('No players match that name.')}</p>}
      </fieldset>
      <p className="field-hint" aria-live="polite">{t('{count} players selected', { count: chosen.length })}{exists && ' · ' + t('This group already exists.')}</p>
      <button type="button" className="secondary-button" disabled={disabled || saving || loading || chosen.length < 2 || exists} onClick={() => save()}><Icon name="plus" size={16} />{saving ? t('Saving...') : t('Save separation group')}</button>
    </>}
    {error && <p role="alert" className="form-error">{t(error)} <button type="button" className="text-link" disabled={saving} onClick={load}>{t('Try again')}</button></p>}
  </details>
}
