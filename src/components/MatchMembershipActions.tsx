import type { Session } from '../lib/database.types'
import { useI18n } from '../context/LanguageContext'
import Icon from './Icon'

export default function MatchMembershipActions({ match, joined, disabled, onJoin, onLeave }: {
  match: Session; joined: boolean; disabled: boolean; onJoin: () => void; onLeave: () => void
}) {
  const { t } = useI18n()
  if (match.cancelled_at || match.home_squad !== null || (joined && match.locked)) return null
  return <div className="match-membership-actions">
    <button type="button" className={joined ? 'secondary-button full-width match-leave-button' : 'primary-button full-width'} disabled={disabled} onClick={joined ? onLeave : onJoin}>
      <Icon name={joined ? 'logout' : 'plus'} size={18} />{joined ? t('Leave this match') : t('Join this match')}
    </button>
    {!joined && match.status === 'completed' && <p className="field-hint">{t('Teams are already generated. Joining now adds you as a substitute.')}</p>}
  </div>
}
