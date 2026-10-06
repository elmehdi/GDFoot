import { useI18n } from '../context/LanguageContext'
import { playerSkills, skillLabel, type SkillRatings } from '../lib/playerSkills'

export default function SkillRatingFields({ value, onChange, disabled = false }: { value: SkillRatings; onChange: (value: SkillRatings) => void; disabled?: boolean }) {
  const { t } = useI18n()
  return <fieldset className="skill-rating-fields" disabled={disabled}>
    <legend>{t('Card skills')} <span>{t('Optional')}</span></legend>
    <p className="field-hint">{t('Just for fun. Only the overall rating balances teams. Leave any skill blank.')}</p>
    <div className="skill-rating-inputs">{playerSkills.map(({ key, label }) => <label key={key}><span>{t(label)}</span><select value={value[key] ?? ''} onChange={event => onChange({ ...value, [key]: event.target.value ? Number(event.target.value) : null })}><option value="">{t('Not rated')}</option>{[2, 4, 6, 8, 10].map(score => <option key={score} value={score}>{t(skillLabel(key, score))}</option>)}</select></label>)}</div>
  </fieldset>
}
