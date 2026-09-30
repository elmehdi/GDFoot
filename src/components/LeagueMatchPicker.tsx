import { useI18n } from '../context/LanguageContext'
import { useState } from 'react'
import Avatar from './Avatar'
import Icon from './Icon'
import StadiumPicker from './StadiumPicker'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/database.types'

const names = ['Blue', 'Red', 'Green', 'Purple', 'Gold', 'Pink']
const colors = ['#80aaff', '#fa9692', '#86cda8', '#bda0ec', '#e6ca81', '#e5a9cc']
export default function LeagueMatchPicker({ leagueId, squads, onCancel, onCreated }: { leagueId: string; squads: Map<number, (Profile & { squad: number | null })[]>; onCancel: () => void; onCreated: (id: string) => void }) {
  const { t } = useI18n()

  const [home, setHome] = useState<number | null>(null)
  const [away, setAway] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [stadiumId, setStadiumId] = useState<string | null>(null)
  const [stadiumPending, setStadiumPending] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const squadName = (number: number) => t(names[(number - 1) % names.length])
  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!home || !away || home === away || busy || stadiumPending) return
    setBusy(true); setError('')
    try {
      const { data, error: issue } = await supabase.rpc('create_league_match', { p_league_id: leagueId, p_match_name: name.trim() || `${squadName(home)} vs ${squadName(away)}`, p_home_squad: home, p_away_squad: away, ...(stadiumId ? { p_stadium_id: stadiumId } : {}) })
      if (issue || !data) throw issue
      onCreated(data)
    } catch { setError(t("The match could not be created. Please try again.")) }
    finally { setBusy(false) }
  }
  return <form className="club-panel matchup-picker" onSubmit={create} id="matchup-picker"><div className="section-heading"><div><span className="overline">{t("SET THE FIXTURE")}</span><h2>{t("Who’s playing who?")}</h2></div><button type="button" className="icon-button" aria-label={t("Close match setup")} onClick={onCancel}><Icon name="close" /></button></div><p>{t("Pick a home team, then an opponent. The players below will be added to the match.")}</p><div className="matchup-preview"><button type="button" aria-label={t("Change home team")} onClick={() => { setHome(null); setAway(null) }}><span>{t("HOME TEAM")}</span><strong style={{ color: home ? colors[(home - 1) % colors.length] : undefined }}>{home ? squadName(home) : t("Choose a team")}</strong></button><b>VS</b><button type="button" aria-label={t("Change away team")} onClick={() => setAway(null)}><span>{t("AWAY TEAM")}</span><strong style={{ color: away ? colors[(away - 1) % colors.length] : undefined }}>{away ? squadName(away) : t("Choose an opponent")}</strong></button></div><p className="selection-instruction"><span className="step-number">{!home ? '01' : !away ? '02' : '03'}</span>{!home ? t("Select the home team below") : !away ? t("Now select the opposing team") : t("Both teams selected. Review and create your match.")}</p><div className="squad-choice-grid">{Array.from(squads.entries()).map(([number, players]) => <button type="button" key={number} aria-pressed={number === home || number === away} className={'squad-choice ' + (number === home || number === away ? 'selected' : '')} onClick={() => { if (number === home) { setHome(null); setAway(null) } else if (number === away) setAway(null); else if (home === null) setHome(number); else setAway(number) }}><div className="squad-choice-heading"><Icon name="shirt" size={30} style={{ color: colors[(number - 1) % colors.length] }} /><div><strong>{squadName(number)}  {t("squad")}</strong><span>{players.length}  {t("players")}</span></div><span className="squad-selection-label">{number === home ? t("HOME") : number === away ? t("AWAY") : t("SELECT")}</span></div><div className="choice-roster">{players.map(player => <div key={player.id}><Avatar name={player.display_name} size="sm" /><span>{player.display_name}</span></div>)}</div></button>)}</div><label htmlFor="fixture-name">{t("Match name")} <span className="muted">{t("(optional)")}</span></label><input id="fixture-name" className="input-field" placeholder={home && away ? `${squadName(home)} vs ${squadName(away)}` : t("e.g. Friday matchday")} value={name} onChange={event => setName(event.target.value)} /><StadiumPicker value={stadiumId} onChange={setStadiumId} onPendingChange={setStadiumPending} disabled={busy} />{error && <p role="alert" className="form-error">{error}</p>}<div className="setup-actions"><button type="button" className="secondary-button" onClick={onCancel}>{t("Cancel")}</button><button className="primary-button" type="submit" disabled={!home || !away || home === away || busy || stadiumPending}>{busy ? t("Creating match...") : t("Create match with these teams")}<Icon name="arrow" /></button></div></form>
}
