# Go&Dev - Football Team Balancer

Go&Dev helps a group organize football matches and form balanced teams. Players rate people they know once and can update their own ratings later. Only the person who submitted a rating can see it; the team generator uses combined ratings on the server.

## How it works

1. Sign up with an email address. On **Players**, rate the teammates you know.
2. Organize a match with a date, format, and stadium, or join an existing match. The organizer chooses whether they will play.
3. The organizer assigns positions and can select groups of players who must be on different teams.
4. Once at least two full teams have joined, the organizer generates and confirms the lineup. Players receive an in-app notification when teams are ready.
5. Save or share the team image. The match page also shows the stadium and Google Maps or Waze navigation links when a map pin is available.

Players do not have to complete a separate rating round for each match. Organizers can return to setup before confirming a proposed lineup, or cancel a match; joined players receive an in-app cancellation notice.

## Setup

1. Install Node.js and run `npm install`.
2. Create a project at [Supabase](https://supabase.com). In its **SQL Editor**, run `supabase/schema.sql`, `supabase/grants.sql`, `supabase/grants_007_league.sql`, then migrations `008` through `018` in numerical order. For an existing project, run only the migrations you have not applied yet.
3. Copy `.env.example` to `.env` and set:

   ```text
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

Open [http://localhost:5173](http://localhost:5173). On Windows, if `npm run dev` fails because the project path contains `&`, run `node node_modules/vite/bin/vite.js` instead.

## Team generation

The server-side generator uses saved private ratings and organizer-assigned positions to prefer balanced teams. It respects team size and separation groups. Every complete team is filled before remaining players go on the bench: in 6v6, 18 players make three teams; 20 make three teams plus two substitutes. At least two full teams are required. A player without ratings receives the default skill value of 5. The method is a balancing heuristic, so equal strength is not guaranteed.

The organizer can select two or more players in a separation group using selectable cards. Each member of a group must be assigned to a different playing team, or to an available surplus bench place. Impossible combinations fail without changing the saved lineup. Only the organizer can see or edit these groups and match positions.

## Privacy and notifications

Players can open a profile to see and edit **their own rating** of that player. Other voters' ratings and combined scores are not shown in the app. Self-rating is disabled.

The notification bell reminds a signed-in user about club members they have not rated. It also shows team-ready and match-cancellation notices for matches they joined. These are in-app notifications, refreshed while the app is open; they are not email or operating-system push messages.

## Stadiums and languages

New stadiums require a map pin. A stadium's creator can update its pin; a match organizer can place the first pin on an existing unpinned stadium used by their match. Existing unpinned stadiums remain usable but do not show navigation links until a pin is added. The map uses OpenStreetMap tiles with visible attribution.

French is the default language. The FR / EN switch remembers the choice in the current browser. Player, match, and stadium names are not translated.

## Tech stack

- React 19, TypeScript, Vite, React Router 7
- Supabase Auth and PostgreSQL with Row Level Security
- Tailwind CSS
- Leaflet and OpenStreetMap for the stadium picker
- `html-to-image` for sharing a lineup image

To delete **all users and app data** while keeping the database schema, see `supabase/reset_all_data.sql`. Run it only if a permanent reset is intended.
