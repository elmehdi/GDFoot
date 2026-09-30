import { useI18n } from '../context/LanguageContext'
import { useState } from 'react'
import { useClubDirectory } from '../context/ClubDirectoryContext'
import { supabase } from '../lib/supabase'
import StadiumPicker from './StadiumPicker'
import Icon from './Icon'
export default function MatchVenue({ matchId, stadiumId, canEdit, onSaved }: { matchId: string; stadiumId: string | null | undefined; canEdit: boolean; onSaved: (id: string | null) => void }) {
  const { t } = useI18n()

  const { stadiumName } = useClubDirectory()
  const [editing, setEditing] = useState(false)
  const [selected, setSelected] = useState<string | null>(stadiumId ?? null)
  const [pending, setPending] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
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
  return <section className="match-venue"><div className="match-venue-summary"><Icon name="pin" size={22} /><div><span className="overline">{t("WHERE WE PLAY")}</span><strong>{stadiumName(stadiumId)}</strong></div>{canEdit && !editing && <button className="secondary-button" onClick={() => { setSelected(stadiumId ?? null); setError(''); setPending(false); setEditing(true) }}>{stadiumId ? t("Change stadium") : t("Choose stadium")}</button>}</div>{editing && <div className="match-venue-editor"><StadiumPicker value={selected} onChange={setSelected} onPendingChange={setPending} disabled={saving} />{error && <p className="form-error" role="alert">{error}</p>}<div className="button-row"><button className="primary-button" disabled={pending || saving} onClick={save}>{saving ? t("Saving...") : t("Save match location")}</button><button className="quiet-button" disabled={saving || pending} onClick={() => setEditing(false)}>{t("Cancel")}</button></div></div>}</section>
}
