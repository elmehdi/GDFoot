import { useI18n } from '../context/LanguageContext'
import PlayerDirectory from '../components/PlayerDirectory'
export default function Players() {
  const { t } = useI18n()

  return <div className="page-stack"><div className="page-heading"><div><p className="overline">{t("YOUR FOOTBALL COMMUNITY")}</p><h1>{t("Meet the players.")}</h1><p>{t("Everyone at Go&Dev, in one place.")}</p></div></div><PlayerDirectory /></div>
}
