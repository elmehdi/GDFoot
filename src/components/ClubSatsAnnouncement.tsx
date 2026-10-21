import { Link } from 'react-router-dom'
import { useI18n } from '../context/LanguageContext'
import { useClubWallet } from '../context/ClubWalletContext'
import Icon from './Icon'
import BitcoinLogo from './BitcoinLogo'

export default function ClubSatsAnnouncement() {
  const { language } = useI18n()
  const { wallet } = useClubWallet()
  const fr = language === 'fr'
  return <section className="club-sats-announcement" aria-label={fr ? 'Nouveauté : club sats' : 'New: club sats'}>
    <div className="wallet-bitcoin-watermark announcement-bitcoin-watermark" aria-hidden="true"><BitcoinLogo /></div>
    <div><span className="bitcoin-eyebrow">{fr ? 'NOUVEAU · CLUB SATS' : 'NEW · CLUB SATS'}</span><h2>{fr ? 'Tes avis valent des sats.' : 'Your opinions just got a currency.'}</h2><p>{fr ? 'Gagne des sats en notant les joueurs et en votant au Vestiaire. Utilise ton wallet pour débloquer le mode clair, pour toujours.' : 'Earn sats by rating players and voting in the Locker Room. Spend your balance to unlock light mode for good.'}</p><span className="announcement-rewards">+{wallet?.rating_reward ?? 100} {fr ? 'par joueur noté' : 'per player rated'} · +{wallet?.vote_reward ?? 25} {fr ? 'par vote au Vestiaire' : 'per Locker Room vote'}</span></div>
    <Link to="/pro#club-wallet" className="bitcoin-button">{fr ? 'Ouvrir mon wallet' : 'Open my wallet'}<Icon name="arrow" size={17} /></Link>
  </section>
}
