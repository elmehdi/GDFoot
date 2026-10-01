# ⚽ G&D Foot - Team Balancer

Create balanced football teams where nobody knows anyone's score. Players privately rate each other once and can update those ratings anytime. The organizer generates teams from saved ratings.

## How It Works

1. **Sign up** via email
2. **Create a session** for your match day
3. **Players join** the session
4. **Complete missing ratings** in the dedicated player ratings page; no match-specific rating round.
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

The PostgreSQL functions calculate skill from saved private player ratings.
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

## Players who must stay on different teams

Run migration 011, then supabase/migration_012_separation_groups.sql.
Organizers can select two, three, or more joined players in a searchable checklist.
Every group member must be on a different playing team. Existing two-player
settings migrate automatically. Only the organizer can read or change groups.
No reasons are stored.

A three-player group needs three teams or an existing surplus bench place.
The generator never creates extra substitutes to avoid a constraint. Impossible
or excessively complex combinations fail without changing the lineup. Both
rating sources and rebalances respect groups. Leaving players are removed from
saved groups. Confirmed teams and fixed league squads remain fixed.

## Saved ratings and notifications (migration 013)

Run `supabase/migration_013_saved_ratings_flow.sql` after migration 012.
Joining is the only match participation step. The organizer generates teams directly
from saved private ratings, with positions and separation groups still applied.
Players see links for missing ratings; no fresh ratings are requested for each match.
The notification bell lists signed-in club members the current user has not rated.
It refreshes every 15 seconds while visible and on focus, persists across visits,
and clears a player's reminder after their rating is saved. Accounts that have never
signed in do not appear. Existing unrated members also appear so everyone can catch up.
These are in-app notifications, not email or operating-system push messages.
Migration 013 reopens unfinished voting sessions and preserves historical votes.
Run `supabase/migration_014_full_teams.sql` after migration 013 to fill every complete team. For 6-a-side: 18 players form three teams; 20 form three teams plus two substitutes. At least two full teams are required.
Missing aggregate ratings retain the existing default skill value of 5.

## Team-ready notifications (migration 017)

Run `supabase/migration_017_team_ready_notifications.sql` after migration 016.
Generating a lineup adds a private in-app notification for every player in that
match. The notification links to the proposed teams. Returning to player setup
removes the old notice; generating again creates a new one. Cancelling a match
replaces its ready notices with cancellation notices. Overview features the most
recent ready match that the signed-in player joined, ahead of open matches.
