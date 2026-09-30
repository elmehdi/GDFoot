# ⚽ G&D Foot - Team Balancer

Create balanced football teams where nobody knows anyone's score. Players vote anonymously on skill levels, and the algorithm builds fair teams automatically.

## How It Works

1. **Sign up** via email
2. **Create a session** for your match day
3. **Players join** the session
4. **Vote anonymously** — rate each player 1-10 (nobody sees your votes)
5. **Generate teams** — the algorithm balances teams so overall power is equal
6. **See the result** — only team assignments are shown, never individual scores

Privacy is core: votes are anonymous, scores are never exposed, and the team-balancing runs server-side so no data leaks to the client.

## Setup

### 1. Install Node.js

Download and install from [nodejs.org](https://nodejs.org/) (LTS recommended).

### 2. Install dependencies

```bash
npm install
```

### 3. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `supabase/schema.sql`
3. Copy `.env.example` to `.env` and fill in your Supabase credentials:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Team Balancing Algorithm

Uses a greedy assignment strategy. With migration 010 installed:
- Group players by their organizer-assigned position, with flexible players last.
- Process stronger players first within each position, with a small tie-break jitter.
- Prefer the team with fewer players in that position, then lower total skill.
- Respect team capacity and put excess players on the bench.

The PostgreSQL functions calculate skill from private match votes or saved ratings.
Only team assignments are returned; combined scores stay in the database.
This is a practical balancing heuristic, not a guarantee of identical team strength.

## Tech Stack

- **React 19** + TypeScript + Vite
- **Supabase** — Auth (email/password), PostgreSQL, Row Level Security
- **Tailwind CSS** — styling
- **React Router 7** — navigation

## Stadium locations

For an existing database with fixed league squads, run
`supabase/migration_009_stadiums.sql` in the Supabase SQL Editor.
It adds the shared stadium list and an optional stadium on each match.
Existing match data is preserved. The app lets you add stadiums under **Stadiums**
or directly while creating a match, and organizers can change a match's stadium.

For a fresh database, run `schema.sql`, `grants.sql`, `grants_007_league.sql`,
`migration_008_fixed_squads.sql`, then `migration_009_stadiums.sql`.

## Player positions, private ratings, and language

After migration 009, run `supabase/migration_010_player_positions.sql` in the
Supabase SQL Editor before using the updated match screens. It adds per-match
positions, restricts position assignment and team generation to the organizer,
and balances positions as well as skill. Existing players default to flexible.
Confirmed teams and fixed league fixtures cannot be rebalanced. Fixed league
squads keep their season assignments.

Click a player in the directory, match roster, or lineup to open your own
editable rating. The database keeps each voter's ratings private; neither
individual ratings from other voters nor combined skill scores are displayed.
Self-rating is disabled. Scores shown in the private editor are **your submitted
rating**, not an aggregate rating of you.

French is the default language. The FR / EN switch remembers the choice on the
current browser. Player names, match names, and stadium names are not translated.

On Windows, if `npm run dev` fails because the project folder contains `&`, run:

```powershell
node node_modules/vite/bin/vite.js
```
