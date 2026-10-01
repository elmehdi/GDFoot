import { useI18n } from '../context/LanguageContext'
import { useId, useState } from 'react'
import { useClubDirectory } from '../context/ClubDirectoryContext'
import type { Coordinates } from '../lib/maps'
import { stadiumCoordinates } from '../lib/maps'
import StadiumMapPicker from './StadiumMapPicker'
import Icon from './Icon'

export default function StadiumPicker({ value, onChange, disabled = false, onPendingChange }: { value: string | null; onChange: (id: string | null) => void; disabled?: boolean; onPendingChange?: (pending: boolean) => void }) {
  const { t } = useI18n()
  const { stadiums, stadiumsLoading, stadiumsError, refreshStadiums, addStadium } = useClubDirectory()
  const fieldId = useId()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [location, setLocation] = useState<Coordinates | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const selected = stadiums.find(stadium => stadium.id === value)
  const open = () => { setAdding(true); setError(''); setMessage(''); onPendingChange?.(true) }
  const cancel = () => { setAdding(false); setName(''); setLocation(null); setError(''); onPendingChange?.(false) }
  const save = async () => {
    if (saving || !name.trim() || !location) return
    setSaving(true); setError('')
    try {
      const stadium = await addStadium(name, location)
      onChange(stadium.id); setAdding(false); setName(''); setLocation(null); setMessage(t('{name} selected.', { name: stadium.name })); onPendingChange?.(false)
    } catch (issue) { setError(issue instanceof Error ? issue.message : t('Could not save this stadium.')) }
    finally { setSaving(false) }
  }
  return <div className="stadium-picker"><label htmlFor={fieldId}>{t('Stadium')} <span className="muted">{t('(optional)')}</span></label><div className="stadium-select-row"><select id={fieldId} className="input-field" value={value ?? ''} onChange={event => { onChange(event.target.value || null); setMessage('') }} disabled={disabled || stadiumsLoading || !!stadiumsError || adding}><option value="">{stadiumsLoading ? t('Loading stadiums...') : t('Choose a stadium or decide later')}</option>{stadiums.map(stadium => <option value={stadium.id} key={stadium.id}>{stadium.name}</option>)}</select>{!adding && <button type="button" className="secondary-button" onClick={open} disabled={disabled || !!stadiumsError || stadiumsLoading}><Icon name="plus" size={16} />{t('Add stadium')}</button>}</div>{selected && !stadiumCoordinates(selected) && !adding && <p className="field-hint">{t('This stadium has no map pin yet. Its creator can add one in Stadiums.')}</p>}{stadiumsError ? <div role="alert" className="form-error">{stadiumsError}<button type="button" className="text-link" onClick={refreshStadiums}>{t('Try again')}</button></div> : !adding && !selected && <p className="field-hint">{t('Add a stadium and place its pin on the map.')}</p>}{adding && <div className="inline-stadium-form"><label htmlFor={fieldId + '-name'}>{t('New stadium name')}</label><input id={fieldId + '-name'} className="input-field" value={name} onChange={event => setName(event.target.value)} placeholder={t('e.g. Stade Municipal')} maxLength={120} autoFocus disabled={saving} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void save() } }} /><StadiumMapPicker value={location} onChange={setLocation} />{error && <p className="form-error" role="alert">{error}</p>}<div className="button-row"><button type="button" className="primary-button" disabled={saving || !name.trim() || !location} onClick={save}>{saving ? t('Saving...') : t('Save & select stadium')}</button><button type="button" className="quiet-button" disabled={saving} onClick={cancel}>{t('Cancel')}</button></div></div>}{message && <p role="status" className="field-hint">{message}</p>}</div>
}
