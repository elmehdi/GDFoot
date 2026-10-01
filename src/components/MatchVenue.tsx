import { useI18n } from '../context/LanguageContext'
import { useState } from 'react'
import { useClubDirectory } from '../context/ClubDirectoryContext'
import { supabase } from '../lib/supabase'
import StadiumPicker from './StadiumPicker'
import Icon from './Icon'
import { directionsLinks, stadiumCoordinates, type Coordinates } from '../lib/maps'
import StadiumMapPicker from './StadiumMapPicker'
export default function MatchVenue({ matchId, stadiumId, canEdit, onSaved }: { matchId: string; stadiumId: string | null | undefined; canEdit: boolean; onSaved: (id: string | null) => void }) {
  const { t } = useI18n()

  const { stadiumName, stadiums, refreshStadiums } = useClubDirectory()
  const point = stadiumCoordinates(stadiums.find(stadium => stadium.id === stadiumId))
  const links = point ? directionsLinks(point) : null
  const [editing, setEditing] = useState(false)
  const [pinEditing, setPinEditing] = useState(false)
  const [pin, setPin] = useState<Coordinates | null>(null)
  const [selected, setSelected] = useState<string | null>(stadiumId ?? null)
  const [pending, setPending] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const savePin = async () => {
    if (!pin || saving) return
    setSaving(true); setError('')
    const result = await supabase.rpc('set_match_stadium_pin', { p_session_id: matchId, p_latitude: pin.latitude, p_longitude: pin.longitude })
    if (result.error) setError(t('Could not save the stadium pin.'))
    else { await refreshStadiums(); setPinEditing(false); setPin(null) }
    setSaving(false)
  }
  const save = async () => {
    if (pending || saving) return
    setSaving(true); setError('')
    try {
      const { error: issue } = await supabase.from('sessions').update({ stadium_id: selected }).eq('id', matchId)
      if (issue) throw issue
      onSaved(selected); setEditing(false)
    } catch { setError(t("Could not update the stadium. Please try again.")) }
    finally { setSaving(false) }
  }
  return <section className="match-venue"><div className="match-venue-summary"><Icon name="pin" size={22} /><div><span className="overline">{t("WHERE WE PLAY")}</span><strong>{stadiumName(stadiumId)}</strong></div>{canEdit && !editing && <button className="secondary-button" onClick={() => { setSelected(stadiumId ?? null); setError(''); setPending(false); setEditing(true) }}>{stadiumId ? t("Change stadium") : t("Choose stadium")}</button>}</div>{canEdit && stadiumId && !links && !editing && !pinEditing && <button className="text-link" onClick={() => { setPin(null); setError(''); setPinEditing(true) }}>{t('Add map pin for this match')}</button>}{pinEditing && <div className="match-venue-editor"><StadiumMapPicker value={pin} onChange={setPin} /><div className="button-row"><button className="primary-button" disabled={!pin || saving} onClick={savePin}>{t('Save pin')}</button><button className="quiet-button" disabled={saving} onClick={() => setPinEditing(false)}>{t('Cancel')}</button></div>{error && <p role="alert" className="form-error">{error}</p>}</div>}{links && <div className="stadium-navigation"><a href={links.google} target="_blank" rel="noopener noreferrer">{t('Navigate with Google Maps')} ↗</a><a href={links.waze} target="_blank" rel="noopener noreferrer">{t('Navigate with Waze')} ↗</a></div>}{editing && <div className="match-venue-editor"><StadiumPicker value={selected} onChange={setSelected} onPendingChange={setPending} disabled={saving} />{error && <p className="form-error" role="alert">{error}</p>}<div className="button-row"><button className="primary-button" disabled={pending || saving} onClick={save}>{saving ? t("Saving...") : t("Save match location")}</button><button className="quiet-button" disabled={saving || pending} onClick={() => setEditing(false)}>{t("Cancel")}</button></div></div>}</section>
}
