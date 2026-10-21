import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useClubWallet } from '../context/ClubWalletContext'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import ClubWalletActivity from './ClubWalletActivity'

export default function ClubWalletPanel({ logo }: { logo: ReactNode }) {
  const { user } = useAuth()
  const { wallet, loading, error, refresh, unlockLightMode } = useClubWallet()
  const { theme, enableLightMode } = useTheme()
  const { language } = useI18n()
  const fr = language === 'fr'
  const number = (value: number) => value.toLocaleString(fr ? 'fr-FR' : 'en-GB')
  const [busy, setBusy] = useState(false)
  const [purchaseError, setPurchaseError] = useState(false)
  const redeem = async () => {
    if (busy) return
    setBusy(true); setPurchaseError(false)
    try { await unlockLightMode() } catch { setPurchaseError(true); void refresh() }
    finally { setBusy(false) }
  }
  return <section id="club-wallet" className="bitcoin-card club-wallet" aria-label={fr ? 'Votre wallet club sats' : 'Your club sats wallet'}>
    <div className="wallet-bitcoin-watermark" aria-hidden="true">{logo}</div>
    <div className="bitcoin-card-heading"><span className="bitcoin-coin">{logo}</span><div><span className="bitcoin-eyebrow">CLUB SATS WALLET</span><h2>{fr ? 'Bitcoin a financé des trucs plus sombres.' : 'Bitcoin has funded darker things.'}</h2></div></div>
    <p className="bitcoin-description">{wallet?.light_mode_unlocked
      ? (fr ? 'Toi, t’as acheté le mode clair.' : 'You bought light mode.')
      : (fr ? 'Toi, tu économises pour le mode clair.' : 'You’re saving up for light mode.')}</p>
    {loading && !wallet ? <p role="status">{fr ? 'Chargement du wallet…' : 'Loading wallet…'}</p> : null}
    {error && <p className="wallet-error" role="alert">{fr ? 'Wallet indisponible pour le moment.' : 'Wallet unavailable right now.'} <button type="button" className="bitcoin-back" onClick={() => void refresh()}>{fr ? 'Réessayer' : 'Retry'}</button></p>}
    {wallet && <>
      <div className="wallet-balance"><span>{fr ? 'VOTRE SOLDE' : 'YOUR BALANCE'}</span><strong>{number(wallet.balance)} <small>club sats</small></strong><span>{fr ? 'Monnaie du club · sans valeur monétaire' : 'Club currency · no cash value'}</span></div>
      <div className="wallet-unlock">
        <div className="wallet-unlock-heading"><div><span className="bitcoin-eyebrow">{fr ? 'À VOUS DE JOUER' : 'YOURS TO EARN'}</span><h3>{fr ? 'Le mode clair, pour toujours.' : 'Light mode. Yours forever.'}</h3></div><span className="wallet-price">{wallet.light_mode_unlocked ? (fr ? 'DÉBLOQUÉ' : 'UNLOCKED') : number(wallet.light_mode_price) + ' sats'}</span></div>
        <p>{fr ? 'Le mode clair uniquement. Le reste du pack Pro garde son mystère.' : 'Light mode only. The rest of Pro keeps its mystery.'}</p>
        {!wallet.light_mode_unlocked ? <>
          <progress aria-label={fr ? 'Progression vers le mode clair' : 'Progress toward light mode'} max={wallet.light_mode_price} value={Math.min(wallet.balance, wallet.light_mode_price)} />
          <p className="wallet-progress-label">{wallet.balance >= wallet.light_mode_price ? (fr ? 'Vous avez le solde nécessaire.' : 'You have enough to unlock it.') : fr ? `Encore ${number(wallet.light_mode_price - wallet.balance)} sats. Le prix ne bougera pas.` : `${number(wallet.light_mode_price - wallet.balance)} sats to go. Your price stays fixed.`}</p>
          <button type="button" className="bitcoin-button" disabled={busy || error || wallet.balance < wallet.light_mode_price} onClick={() => void redeem()}>{busy ? (fr ? 'Déblocage…' : 'Unlocking…') : (fr ? 'Débloquer le mode clair' : 'Unlock light mode')} <span aria-hidden="true">→</span></button>
        </> : <><p role="status">{fr ? 'Acquis définitivement. Changez de thème à tout moment avec le bouton en haut.' : 'Permanently yours. Switch themes anytime using the button above.'}</p>{theme !== 'light' && <button type="button" className="bitcoin-button" onClick={enableLightMode}>{fr ? 'Activer le mode clair' : 'Switch to light mode'}</button>}</>}
        {purchaseError && <p className="wallet-error" role="alert">{fr ? 'Déblocage impossible. Vérifiez votre solde et réessayez.' : 'Could not unlock light mode. Check your balance and try again.'}</p>}
      </div>
      <div className="wallet-earn-grid">
        <Link to="/ratings"><strong>+{wallet.rating_reward} sats</strong><span>{fr ? 'par joueur noté' : 'per player rated'}</span><small>{fr ? 'Une fois par joueur, notes existantes incluses.' : 'Once per player, including existing ratings.'}</small><b>{fr ? 'Noter les joueurs' : 'Rate players'} →</b></Link>
        <Link to="/vestiaire"><strong>+{wallet.vote_reward} sats</strong><span>{fr ? 'par vote au Vestiaire' : 'per Locker Room vote'}</span><small>{fr ? 'Une fois par question et par match, Homme du match inclus.' : 'Once per question per match, including Man of the Match.'}</small><b>{fr ? 'Ouvrir le Vestiaire' : 'Open the Locker Room'} →</b></Link>
      </div>
      <ClubWalletActivity key={user?.id} recent={wallet.entries} />
    </>}
  </section>
}
