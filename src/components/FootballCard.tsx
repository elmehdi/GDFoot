import { useI18n } from '../context/LanguageContext'
import type { Profile } from '../lib/database.types'
import { playerSkills, type SkillLabels } from '../lib/playerSkills'

export default function FootballCard({ player, labels, own = false }: { player: Profile; labels?: SkillLabels; own?: boolean }) {
  const { t } = useI18n()
  const displayName = player.display_name.trim().replace(/\s+/g, ' ')
  const initials = player.display_name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase() || '?'
  const themes = ['lime', 'coral', 'sky', 'violet']
  const theme = themes[Array.from(player.display_name).reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % themes.length]
  return <div className={'football-card football-card--' + theme}>
    <div className="football-card-tape" aria-hidden="true">GO&DEV</div>
    <div className="football-card-header"><span>{own ? t('YOU') : t('Club player')}</span></div>
    <div className="football-card-portrait">{player.avatar_url ? <img src={player.avatar_url} alt="" onError={event => { event.currentTarget.hidden = true }} /> : null}<span aria-hidden="true">{initials}</span><div className="football-card-shirt" aria-hidden="true">11</div></div>
    <h2><small>THE</small><span className="football-card-name">{displayName}</span></h2>
    <div className="football-card-rule"><span>{t('Local legend')}</span></div>
    <dl className="football-card-skills">{playerSkills.map(({ key, label }) => <div key={key}><dt>{t(label)}</dt><dd>{t(labels?.[key] ?? 'Not rated')}</dd></div>)}</dl>
    <div className="football-card-footer"><span>EST. MATCHDAY</span><b>✦</b><span>Go&Dev FC</span></div>
  </div>
}
