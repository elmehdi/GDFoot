import { useI18n } from '../context/LanguageContext'
import PlayerDirectory from '../components/PlayerDirectory'
export default function Players() {
  const { t } = useI18n()

  return <div className="page-stack player-cards-page"><div className="page-heading"><div><p className="overline">{t('FRIENDS FC · GO&DEV')}</p><h1>{t('Your squad.')}<br /><em>{t('Their own cards.')}</em></h1><p>{t('Tap a card to rate a friend. Skill labels are just for fun; the overall rating stays private.')}</p></div><span className="player-cards-stamp">{t('Made for the squad')}</span></div><PlayerDirectory /></div>
}
