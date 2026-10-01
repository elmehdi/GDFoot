import { useI18n } from '../context/LanguageContext'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Icon from '../components/Icon'
import StadiumPicker from '../components/StadiumPicker'
import { useClubDirectory } from '../context/ClubDirectoryContext'

const formats = [{ size: 5, name: 'Small pitch. Big energy.', hint: '10 players total' }, { size: 6, name: 'A little more room.', hint: '12 players total' }, { size: 8, name: 'Build a bigger squad.', hint: '16 players total' }, { size: 11, name: 'The full matchday.', hint: '22 players total' }] as const
export default function CreateMatch() {
  const { t } = useI18n()

  const { user } = useAuth()
  const navigate = useNavigate()
  const { stadiumName } = useClubDirectory()
  const [stadiumId, setStadiumId] = useState<string | null>(null)
  const [stadiumPending, setStadiumPending] = useState(false)
  const [size, setSize] = useState<5 | 6 | 8 | 11>(5)
  const [date, setDate] = useState('')
  const [name, setName] = useState('')
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user || !date || !name.trim() || busy || stadiumPending) return
    if (!step) { setStep(1); return }
    setBusy(true); setError('')
    try {
      const { data, error: issue } = await supabase.from('sessions').insert({ name: name.trim(), scheduled_at: new Date(date).toISOString(), team_size: size, created_by: user.id, ...(stadiumId ? { stadium_id: stadiumId } : {}) }).select().single()
      if (issue || !data) throw issue
      const { error: joinIssue } = await supabase.from('session_players').insert({ session_id: data.id, player_id: user.id })
      navigate('/session/' + data.id, { state: { created: true, joinFailed: !!joinIssue } })
    } catch { setError(t("Your match could not be created. Please try again.")) }
    finally { setBusy(false) }
  }
  return <div className="page-stack setup-page"><Link to="/matches" className="back-link"><Icon name="back" size={16} />  {t("Back to matches")}</Link><div className="page-heading"><div><p className="overline">{t("YOU’RE THE ORGANIZER")}</p><h1>{t("Make a game happen.")}</h1><p>{t("Set up the match. Then invite your people.")}</p></div></div><div className="setup-layout"><form onSubmit={create} className="club-panel setup-form"><div className="setup-steps"><span className={step === 0 ? 'active' : 'done'}>{t("01 &nbsp; Match details")}</span><span className={step === 1 ? 'active' : ''}>{t("02 &nbsp; Review & create")}</span></div>{step === 0 ? <><h2>{t("What are we playing?")}</h2><p>{t("Choose the number of players on each side.")}</p><div className="format-grid">{formats.map(format => <button type="button" key={format.size} aria-pressed={size === format.size} onClick={() => setSize(format.size)} className={'format-option ' + (size === format.size ? 'selected' : '')}><span className="format-check">{size === format.size && <Icon name="check" size={14} />}</span><strong>{format.size}<i>v</i>{format.size}</strong><span>{t(format.name)}</span><small>{t(format.hint)}</small></button>)}</div><label htmlFor="new-match-name">{t("Give your match a name")}</label><input id="new-match-name" className="input-field" placeholder={t("e.g. Friday football")} maxLength={100} value={name} onChange={e => setName(e.target.value)} required /><p className="field-hint">{t("Choose a name your friends will recognize.")}</p><label htmlFor="match-date">{t("Match date and time")}</label><input id="match-date" type="datetime-local" className="input-field" required value={date} onChange={e => setDate(e.target.value)} /><p className="field-hint">{t("Times are shown in your local time zone.")}</p><StadiumPicker value={stadiumId} onChange={setStadiumId} onPendingChange={setStadiumPending} disabled={busy} /></> : <><h2>{t("Looking good?")}</h2><p>{t("Check the details before inviting the squad.")}</p><div className="review-match"><Icon name="shirt" size={40} /><h3>{name}</h3><p>{date && new Date(date).toLocaleString()}</p><span>{size} vs {size} · {size * 2}  {t("players")}</span><p className="venue-label"><Icon name="pin" size={16} />{stadiumName(stadiumId)}</p></div><div className="info-note"><Icon name="teams" /><p>{t("You’ll join as the first player. Next, copy the invite link so your friends can join. Teams use your saved player ratings.")}</p></div></>}{error && <p role="alert" className="form-error">{error}</p>}<div className="setup-actions">{step === 1 && <button type="button" className="secondary-button" disabled={busy} onClick={() => setStep(0)}>{t("Edit details")}</button>}<button type="submit" className="primary-button" disabled={!date || !name.trim() || busy || stadiumPending}>{busy ? t("Creating your match...") : step === 0 ? t("Review match") : t("Create match & invite players")}<Icon name="arrow" size={18} /></button></div></form><aside className="setup-aside"><span className="overline">{t("THE GAME PLAN")}</span><h2>{t("A fair match")}<br />{t("starts here.")}</h2><ol><li><b>01</b><div><strong>{t("Set up your match")}</strong><p>{t("Choose a format and give it a name.")}</p></div></li><li><b>02</b><div><strong>{t("Get everyone in")}</strong><p>{t("Send the invite link to your group.")}</p></div></li><li><b>03</b><div><strong>{t("Balance the sides")}</strong><p>{t("Use saved ratings to generate teams, then confirm the lineup.")}</p></div></li></ol><div className="aside-footer"><Icon name="shirt" size={24} /><span>{t("More playing.")}<br />{t("Less organizing.")}</span></div></aside></div></div>
}
