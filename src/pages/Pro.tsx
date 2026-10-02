import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useI18n } from '../context/LanguageContext'
import { useTheme } from '../context/ThemeContext'

export default function Pro() {
  const { language } = useI18n()
  const { startTrial, secondsLeft } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [showContact, setShowContact] = useState(false)
  const requestedFrom = (location.state as { from?: string } | null)?.from
  const fromLightSwitch = (location.state as { fromLightSwitch?: boolean } | null)?.fromLightSwitch === true
  const returnTo = requestedFrom && /^\/(?!\/)/.test(requestedFrom) && !requestedFrom.startsWith('/pro') ? requestedFrom : '/'
  const fr = language === 'fr'

  const tryTheme = () => {
    startTrial()
    navigate(returnTo, { replace: true })
  }

  return <div className="page-stack pro-page">
    <Link to={returnTo} className="back-link">← {fr ? 'Retour à l’application' : 'Back to the app'}</Link>
    <section className="pro-hero club-panel">
      <span className="pro-kicker">GO&DEV PRO</span>
      {fromLightSwitch && <div className="pro-theme-prompt" role="note"><strong>{fr ? 'Vous voulez le mode clair ? Passez à Pro.' : 'Want light mode? Go Pro.'}</strong><span>{fr ? 'L’abonnement Pro inclut le mode clair. Vous pouvez aussi ' : 'Pro includes light mode. You can also '}<button type="button" className="pro-inline-trial" onClick={tryTheme}>{fr ? 'l’essayer' : 'try it'}</button>{fr ? ' gratuitement pendant 8 secondes.' : ' free for 8 seconds.'}</span></div>}
      <h1>{fr ? 'Le talent ne s’achète pas. L’abonnement Pro, si.' : 'Can’t buy talent. Can buy Pro.'}</h1>
      <p>{fr ? 'Le fair-play, c’est pour la version gratuite.' : 'Fair play is for the free version.'}</p>
      <div className="pro-price"><strong>200 MAD</strong><span>{fr ? '/ mois' : '/ month'}</span>
        <button type="button" className="primary-button" onClick={() => setShowContact(true)}>{fr ? 'S’abonner à Pro' : 'Subscribe to Pro'}</button>
      </div>
      {showContact && <p className="pro-contact-note" role="status">{fr ? 'Pour vous abonner, contactez ' : 'To subscribe, get in touch with '}<a href="https://goandev.slack.com/archives/D0AFDAM1U12" target="_blank" rel="noopener noreferrer">Amine LGHALI</a>.</p>}
      <div className="pro-perks">
        <span className="pro-perks-label">{fr ? 'VOS SUPER-POUVOIRS' : 'YOUR SUPERPOWERS'}</span>
        <ul>
          <li><strong>{fr ? 'Mode clair' : 'Light mode'}</strong><span>{fr ? 'Parce que le mode sombre était sûrement la raison de vos tirs ratés.' : 'Because dark mode was obviously why you kept missing the goal.'}</span></li>
          <li><strong>{fr ? 'Qui vous a noté ?' : 'Who rated you?'}</strong><span>{fr ? 'Découvrez les notes et leurs auteurs.' : 'See the ratings and who gave them.'}</span></li>
          <li><strong>{fr ? 'Votre note, vos règles' : 'Your rating, your rules'}</strong><span>{fr ? 'Modifiez la note qui vous a été attribuée.' : 'Change the rating you were given.'}</span></li>
          <li><strong>{fr ? 'Le dernier mot sur le match' : 'The final say on a match'}</strong><span>{fr ? 'Annulez même un match que vous n’organisez pas.' : 'Cancel a match even if you did not organize it.'}</span></li>
          <li><strong>{fr ? 'Entrée refusée' : 'No entry'}</strong><span>{fr ? 'Empêchez un joueur de rejoindre un match.' : 'Stop a player from joining a match.'}</span></li>
          <li><strong>{fr ? 'Votre équipe, votre choix' : 'Your team, your call'}</strong><span>{fr ? 'Choisissez l’équipe dans laquelle vous jouez.' : 'Pick the team you want to play on.'}</span></li>
        </ul>
      </div>
      <div className="pro-theme-trial">
        <span>{fr ? 'Juste curieux du mode clair ?' : 'Just curious about light mode?'}</span>
        <button type="button" className="secondary-button" onClick={tryTheme}>{fr ? 'Essayer le mode clair (8 s)' : 'Try light mode (8 s)'}</button>
      </div>
      {secondsLeft > 0 && <p className="pro-countdown" role="status">{fr ? 'Essai en cours' : 'Trial in progress'} · {secondsLeft} s</p>}
    </section>
  </div>
}
