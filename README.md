# Go&Dev - Football Team Balancer

Go&Dev helps a group organize football matches and form balanced teams. Players rate people they know once and can update their own ratings later. Only the person who submitted a rating can see it; the team generator uses combined ratings on the server.

## How it works

1. Sign up with an email address. On **Players**, rate the teammates you know.
2. Organize a match with a date, format, and stadium, or join an existing match. The organizer chooses whether they will play.
3. The organizer or a designated super admin assigns positions. The organizer can also select groups of players who must be on different teams.
4. Once at least two full teams have joined, the organizer or a super admin generates and confirms the lineup. Players receive an in-app notification when teams are ready.
5. Save or share the team image. The match page also shows the stadium and Google Maps or Waze navigation links when a map pin is available.

Players do not have to complete a separate rating round for each match. Organizers can return to setup before confirming a proposed lineup, or cancel a match; joined players receive an in-app cancellation notice.

Pickup matches can include more than two teams and substitutes. After confirming the lineup, the organizer records each short game separately, choosing its two teams and score. A game ends after 10 minutes or when one team reaches two goals; the losing side rotates out. Fixed league fixtures still use one score for their standings.

**The Locker Room / Le Vestiaire** adds six private pre-match prediction votes and a post-match Man of the Match vote. The organizer closes predictions at kickoff and opens Man of the Match voting after the game. After casting all six predictions, players see live top-three rankings; after casting a Man of the Match vote, they see the current leader. Rankings update as others vote, while individual ballots remain private. Joined players receive an in-app reminder to answer the predictions; opening Man of the Match voting sends another reminder. These votes do not affect private skill ratings or team balancing. Run `supabase/migration_019_vestiaire.sql` after migration 018, then `supabase/migration_020_live_vestiaire_results.sql` and `supabase/migration_021_vestiaire_notifications.sql`.

## Setup

1. Install Node.js and run `npm install`.
2. Create a project at [Supabase](https://supabase.com). In its **SQL Editor**, run `supabase/schema.sql`, `supabase/grants.sql`, `supabase/grants_007_league.sql`, then migrations `008` through `023` in numerical order. For an existing project, run only the migrations you have not applied yet.
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

The server-side generator uses saved private ratings and assigned positions to prefer balanced teams. It respects team size and separation groups. Every complete team is filled before remaining players go on the bench: in 6v6, 18 players make three teams; 20 make three teams plus two substitutes. At least two full teams are required. A player without ratings receives the default skill value of 5. The method is a balancing heuristic, so equal strength is not guaranteed.

The organizer can select two or more players in a separation group using selectable cards. Each member of a group must be assigned to a different playing team, or to an available surplus bench place. Impossible combinations fail without changing the saved lineup. Only the organizer can see or edit these groups. Super admins can assign positions and generate, reopen, rebalance, or confirm teams without organizing or joining a match. Cancellation, match settings, stadium pins, and scores remain organizer-only.

To designate four super admins, run migration `023` and then insert their existing profile UUIDs in the Supabase SQL Editor (replace the placeholders):

```sql
insert into public.match_super_admins (user_id) values
  ('FIRST_USER_UUID'),
  ('SECOND_USER_UUID'),
  ('THIRD_USER_UUID'),
  ('FOURTH_USER_UUID')
on conflict do nothing;
```

Find IDs with `select id, display_name from public.profiles order by display_name;`. Only a database administrator can change the allowlist; the browser cannot read or edit it. Remove access with `delete from public.match_super_admins where user_id = 'USER_UUID';`.

## Privacy and notifications

Players can open a profile to see and edit **their own rating** of that player. Other voters' ratings and combined scores are not shown in the app. Self-rating is disabled.

The notification bell reminds a signed-in user about club members they have not rated. It also shows team-ready, match-cancellation, and Locker Room voting notices for matches they joined. These are in-app notifications, refreshed while the app is open; they are not email or operating-system push messages.

## Stadiums and languages

New stadiums require a map pin. A stadium's creator can update its pin; a match organizer can place the first pin on an existing unpinned stadium used by their match. Existing unpinned stadiums remain usable but do not show navigation links until a pin is added. The map uses OpenStreetMap tiles with visible attribution.

French is the default language. The FR / EN switch remembers the choice in the current browser. Player, match, and stadium names are not translated.

## Password recovery setup

The login page links to `/forgot-password`. Supabase sends a recovery email that returns to `/reset-password`, where the user chooses and confirms a new password. Recovery links create an authenticated session; after saving, the user can continue to the dashboard. No database migration is required.

In Supabase **Authentication > URL Configuration**, set the Site URL to your production origin and add these Redirect URLs (replace the example domain with your deployed domain):

- `http://localhost:5173/reset-password` (use your actual development port)
- `https://your-domain.example/reset-password`

Keep the recovery email template's confirmation link (`{{ .ConfirmationURL }}`) so Supabase verifies the link before redirecting. Configure production SMTP under Authentication email settings for delivery to real users. Ensure your hosting serves the SPA for `/forgot-password` and `/reset-password`.

Verify with a test account: request an email, follow the link, reject mismatched passwords, save a valid password, sign out, and sign in with the new password. Also verify a used/expired link offers a new request and an unknown email gets the generic confirmation. Never paste recovery tokens into logs or screenshots.

## Tech stack

- React 19, TypeScript, Vite, React Router 7
- Supabase Auth and PostgreSQL with Row Level Security
- Tailwind CSS
- Leaflet and OpenStreetMap for the stadium picker
- `html-to-image` for sharing a lineup image

To delete **all users and app data** while keeping the database schema, see `supabase/reset_all_data.sql`. Run it only if a permanent reset is intended.
