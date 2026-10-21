import { Link } from 'react-router-dom'
import { useClubWallet } from '../context/ClubWalletContext'
import { useI18n } from '../context/LanguageContext'

export default function ClubSatsHint({ kind }: { kind: 'rating' | 'vote' }) {
  const { wallet } = useClubWallet()
  const { language } = useI18n()
  if (!wallet) return null
  const fr = language === 'fr'
  return <Link className="club-sats-hint" to="/pro#club-wallet"><strong>+{kind === 'rating' ? wallet.rating_reward : wallet.vote_reward} sats</strong><span>{kind === 'rating'
    ? fr ? 'par joueur noté pour la première fois.' : 'for each player you rate for the first time.'
    : fr ? 'par premier vote à chaque question, Homme du match inclus.' : 'for your first vote on each question, including Man of the Match.'}</span><b>{fr ? 'Mon wallet' : 'My wallet'} →</b></Link>
}
