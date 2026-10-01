import { useI18n } from '../context/LanguageContext'
const steps = ['Invite players', 'Balance teams', 'Ready to play']

export default function MatchProgress({ current }: { current: number }) {
  const { t } = useI18n()

  return (
    <ol className="match-progress" aria-label={t("Match setup progress")}>
      {steps.map((step, index) => (
        <li key={step} className={index === current ? 'is-current' : index < current ? 'is-done' : ''} aria-current={index === current ? 'step' : undefined}>
          <span className="step-number" aria-hidden="true">{index < current ? '\u2713' : '0' + (index + 1)}</span>
          <span>{t(step)}</span>
        </li>
      ))}
    </ol>
  )
}
