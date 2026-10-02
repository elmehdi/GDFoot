import { useI18n } from '../context/LanguageContext'

const balancingCodeEn = `-- Example: 20 players, teams of 6
team_count  = floor(20 / 6)        -- 3 complete teams
substitutes = 20 - team_count * 6 -- 2 players

-- Estimate each player's strength
skill = average(saved_ratings)    -- use 5 if unrated
skill = skill + random(0, 0.4)    -- temporary, not a bias fix

-- Try teams in this order for each player:
-- 1. Fewest players at the same position
-- 2. Lowest total skill
-- 3. Fewest players overall
-- Skip full teams and forbidden pairings.
-- If no assignment works, backtrack and try another.`

const balancingCodeFr = `-- Exemple : 20 joueurs, équipes de 6
team_count  = floor(20 / 6)        -- 3 équipes complètes
substitutes = 20 - team_count * 6 -- 2 remplaçants

-- Estimer le niveau de chaque joueur
skill = average(saved_ratings)    -- 5 si aucune note
skill = skill + random(0, 0.4)    -- provisoire, ne corrige pas les biais

-- Essayer les équipes dans cet ordre :
-- 1. Le moins de joueurs au même poste
-- 2. Le total des niveaux le plus faible
-- 3. Le moins de joueurs au total
-- Écarter les équipes pleines et les paires interdites.
-- Si ça bloque, revenir en arrière et réessayer.`

function highlightedCode(code: string) {
  return code.split(/(--[^\n]*|\b(?:floor|average|random)\b|\b\d+(?:\.\d+)?\b)/g).map((part, index) => {
    const kind = part.startsWith('--') ? 'comment' : /^(floor|average|random)$/.test(part) ? 'function' : /^\d/.test(part) ? 'number' : null
    return kind ? <span key={index} className={`faq-code-${kind}`}>{part}</span> : part
  })
}

const questions = [
  {
    en: 'How many players are needed, and can more join afterward?',
    fr: 'Combien de joueurs faut-il ? D’autres peuvent-ils rejoindre ensuite ?',
    answerEn: 'You need enough players for two full teams before teams can be generated. For 6-a-side, that means 12 players. More players can join while registration is open: 18 make three teams of six, and 20 make three teams plus two substitutes.',
    answerFr: 'Il faut assez de joueurs pour former deux équipes complètes avant de générer les équipes. En 6 contre 6, il en faut 12. D’autres peuvent rejoindre le match tant que les inscriptions sont ouvertes : 18 joueurs forment trois équipes de six, et 20 joueurs donnent trois équipes et deux remplaçants.',
  },
  {
    en: 'How are teams balanced? What happens to substitutes?',
    fr: 'Comment les équipes sont-elles équilibrées ? Que deviennent les remplaçants ?',
    answerEn: 'The app uses saved private ratings to build full teams of similar strength. Any players left after filling complete teams become substitutes. The organizer can also keep selected players on different teams.',
    answerFr: 'L’application utilise les notes privées enregistrées pour former des équipes complètes aussi équilibrées que possible. Les joueurs restants deviennent remplaçants. L’organisateur peut aussi séparer certains joueurs entre les équipes.',
  },
  {
    en: 'Can anyone see the ratings I give players?',
    fr: 'Les autres peuvent-ils voir les notes que je donne ?',
    answerEn: 'No. Only you can see and edit the ratings you give. The app uses them to balance teams, but does not show other players your ratings or a player’s combined score.',
    answerFr: 'Non. Vous seul pouvez voir et modifier les notes que vous donnez. L’application les utilise pour équilibrer les équipes, mais ne montre ni vos notes aux autres joueurs ni la note globale d’un joueur.',
  },
  {
    en: 'When can I see my team?',
    fr: 'Quand pourrai-je voir mon équipe ?',
    answerEn: 'Once the organizer generates the teams, your lineup appears and you receive an in-app notification. It remains a proposed lineup until the organizer confirms it.',
    answerFr: 'Dès que l’organisateur génère les équipes, votre composition s’affiche et vous recevez une notification dans l’application. Elle reste provisoire jusqu’à la confirmation de l’organisateur.',
  },
  {
    en: 'What algorithm balances the teams?',
    fr: 'Quel algorithme équilibre les équipes ?',
    answerEn: 'For each player, the app averages their saved ratings; when there are none, it uses 5. It fills as many complete teams as possible (players ÷ team size, rounded down), with the remainder as substitutes. For each assignment, it prefers a team with fewer players in that position, then a lower total rating, then fewer players. It searches other assignments if needed to respect the organizer’s separation rules. This is a balancing heuristic, not a guarantee of mathematically optimal teams.',
    answerFr: 'Pour chaque joueur, l’application calcule la moyenne des notes enregistrées ; sans note, elle utilise 5. Elle forme autant d’équipes complètes que possible (nombre de joueurs ÷ taille d’équipe, arrondi à l’entier inférieur) ; le reste devient remplaçant. Pour chaque attribution, elle privilégie l’équipe qui compte le moins de joueurs à ce poste, puis celle dont le total des notes est le plus faible, puis celle qui a le moins de joueurs. Si nécessaire, elle essaie d’autres répartitions pour respecter les séparations demandées par l’organisateur. C’est une méthode d’équilibrage, pas une garantie d’optimalité mathématique.',
    noteEn: 'When comparing players to build the teams, the algorithm adds a random amount below 0.4 to each average. This helps break close calls: an average of 7.0 becomes a temporary value between 7.0 and just under 7.4, so regenerating the teams may produce a slightly different lineup. Saved ratings stay the same. This randomness does not correct unfair votes.',
    noteFr: 'Pour comparer les joueurs et former les équipes, l’algorithme ajoute à chaque moyenne un nombre aléatoire inférieur à 0,4. Cela aide à départager les niveaux proches : une moyenne de 7,0 devient provisoirement une valeur entre 7,0 et un peu moins de 7,4. Si les équipes sont régénérées, la composition peut donc varier légèrement. Les notes enregistrées ne changent pas et ce hasard ne corrige pas les votes injustes.',
    codeEn: balancingCodeEn,
    codeFr: balancingCodeFr,
  },
  {
    en: 'Why rate players from 1 to 10, and why should I be fair?',
    fr: 'Pourquoi noter les joueurs de 1 à 10, et pourquoi être juste ?',
    answerEn: 'A 1–10 scale lets you distinguish players whose levels are close; choosing only 1, 3 or 5 would lose some of that detail without preventing generous ratings for friends. The app averages private ratings, so one extreme vote has less influence when several people have rated a player. But averaging cannot remove bias shared by many voters, especially when few ratings exist.',
    answerFr: 'Une échelle de 1 à 10 permet de distinguer des joueurs de niveau proche ; ne choisir qu’entre 1, 3 et 5 ferait perdre cette nuance sans empêcher de surnoter ses amis. L’application calcule la moyenne des notes privées : un vote extrême pèse moins quand plusieurs personnes ont noté le joueur. Mais une moyenne ne peut pas effacer un biais partagé par beaucoup de votants, surtout s’il y a peu de notes.',
    emphasisEn: 'Please judge football ability (technique, teamwork and impact on the game) rather than friendship or frustration from one match. Honest ratings give the teams a better chance of being balanced.',
    emphasisFr: 'Évaluez le niveau de jeu (technique, esprit d’équipe et impact sur le match) plutôt que l’amitié ou la frustration d’une seule partie. Des notes sincères donnent plus de chances d’obtenir des équipes équilibrées.',
  },
  {
    en: 'What if I do not know a player well enough to rate them?',
    fr: 'Et si je ne connais pas assez un joueur pour le noter ?',
    answerEn: 'Just leave their rating empty. Your missing rating is not counted. If nobody has rated that player yet, the team balancer uses a neutral 5/10 until ratings are available.',
    answerFr: 'Laissez simplement sa note vide. Votre absence de note ne compte pas dans la moyenne. Si personne n’a encore noté ce joueur, l’algorithme utilise une valeur neutre de 5/10 en attendant des notes.',
  },
  {
    en: 'How is my password stored?',
    fr: 'Comment mon mot de passe est-il stocké ?',
    answerEn: 'Go&Dev Foot uses Supabase Auth. Supabase stores a salted bcrypt hash of your password, not a readable password in the app’s player database.',
    answerFr: 'Go&Dev Foot utilise Supabase Auth. Supabase conserve une empreinte bcrypt salée de votre mot de passe, pas un mot de passe lisible dans la base des joueurs.',
    href: 'https://supabase.com/docs/guides/auth/password-security',
    linkEn: 'About password security',
    linkFr: 'En savoir plus sur la sécurité des mots de passe',
  },
  {
    en: 'Who can see my personal information?',
    fr: 'Qui peut voir mes informations personnelles ?',
    answerEn: 'Signed-in members can see your display name and player profile. Your email is used for your account and is not shown in the player directory. The people who run Go&Dev Foot have the access needed to maintain accounts and keep the service working.',
    answerFr: 'Les membres connectés peuvent voir votre nom affiché et votre profil de joueur. Votre adresse e-mail sert à votre compte et n’apparaît pas dans l’annuaire des joueurs. Les personnes qui gèrent Go&Dev Foot disposent des accès nécessaires pour maintenir les comptes et assurer le fonctionnement du service.',
  },
  {
    en: 'Can I contribute code, translations, or design?',
    fr: 'Puis-je contribuer au code, aux traductions ou au design ?',
    answerEn: 'Absolutely. Open a pull request on GitHub, suggest an idea, improve a translation, or try a new design. For database changes, contact the project maintainer first to arrange Supabase collaborator access.',
    answerFr: 'Bien sûr ! Ouvrez une pull request sur GitHub, proposez une idée, améliorez une traduction ou imaginez un nouveau design. Pour modifier la base de données, contactez d’abord le responsable du projet afin d’obtenir un accès collaborateur à Supabase.',
    href: 'https://github.com/elmehdi/GDFoot',
    linkEn: 'Contribute on GitHub',
    linkFr: 'Contribuer sur GitHub',
  },
] as const

export default function Faq() {
  const { language } = useI18n()
  const fr = language === 'fr'

  return <section className="faq-section" aria-labelledby="faq-title">
    <div className="faq-heading"><span className="overline">GO&DEV / FAQ</span><h2 id="faq-title">{fr ? 'Les réponses avant le coup d’envoi.' : 'Answers before kickoff.'}</h2><p>{fr ? 'Tout ce qu’il faut savoir pour jouer, noter et contribuer.' : 'Everything you need to play, rate, and contribute.'}</p></div>
    <div className="faq-list">{questions.map((item, index) => <details key={item.en} className="faq-item"><summary><span className="faq-number">{String(index + 1).padStart(2, '0')}</span><span>{fr ? item.fr : item.en}</span><span className="faq-toggle" aria-hidden="true">+</span></summary><div className="faq-answer"><p>{fr ? item.answerFr : item.answerEn}</p>{'noteEn' in item && <p>{fr ? item.noteFr : item.noteEn}</p>}{'emphasisEn' in item && <p><strong>{fr ? item.emphasisFr : item.emphasisEn}</strong></p>}{'codeEn' in item && <details className="faq-code"><summary>{fr ? 'Voir l’algorithme simplifié' : 'See the simplified algorithm'}</summary><pre><code>{highlightedCode(fr ? item.codeFr : item.codeEn)}</code></pre><a href="https://github.com/elmehdi/GDFoot/blob/main/supabase/migration_014_full_teams.sql" target="_blank" rel="noopener noreferrer">{fr ? 'Voir le vrai code SQL' : 'View the actual SQL'} ↗</a></details>}{'href' in item && <a href={item.href} target="_blank" rel="noopener noreferrer">{fr ? item.linkFr : item.linkEn} ↗</a>}</div></details>)}</div>
  </section>
}
