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

Players can leave and rejoin a pickup match from either the match details or the lineup page while teams are unconfirmed. If teams have already been generated, joining adds the player to the bench without changing the existing teams. Confirmed lineups accept new substitutes, but do not offer a leave action. Fixed league fixtures keep their assigned squad rosters.

**The Locker Room / Le Vestiaire** adds six private pre-match prediction votes and a post-match Man of the Match vote. The organizer closes predictions at kickoff and opens Man of the Match voting after the game. After casting all six predictions, players see live top-three rankings; after casting a Man of the Match vote, they see the current leader. Rankings update as others vote, while individual ballots remain private. Joined players receive an in-app reminder to answer the predictions; opening Man of the Match voting sends another reminder. These votes do not affect private skill ratings or team balancing. Run `supabase/migration_019_vestiaire.sql` after migration 018, then `supabase/migration_020_live_vestiaire_results.sql` and `supabase/migration_021_vestiaire_notifications.sql`.

## Setup

1. Install Node.js and run `npm install`.
2. Create a project at [Supabase](https://supabase.com). In its **SQL Editor**, run `supabase/schema.sql`, `supabase/grants.sql`, `supabase/grants_007_league.sql`, then migrations `008` through `027` in numerical order. For an existing project, run only the migrations you have not applied yet.
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

## Post-match voting and optional feedback

After teams are generated, the organizer or a designated super admin can choose **End match & open votes** on the match details or lineup page. This closes predictions and opens Man of the Match voting, sending joined players in-app bell notifications for voting and optional team feedback. Ending the match twice does not duplicate notifications. Super admins can also manage voting phases and see rankings in the Locker Room without joining the match; only joined players can vote.

In the Locker Room, players can answer Happy, Mixed, or Unhappy, add an optional comment up to 500 characters, or choose Skip. Saving or skipping clears their feedback reminder, and they can edit or answer later. Individual responses are readable only by their author. Organizers and super admins see totals and comments without player identities. Feedback does not change skill ratings or team balancing. These are in-app notifications, not push messages or email. Run `supabase/migration_026_post_match_feedback.sql` after migration 025.

The Locker Room list has Active and History tabs with match-name search. Man of the Match standings appear immediately after a player votes, even if they skipped predictions. Closing voting freezes the results and moves a match into History; open it to revisit the final winner and prediction rankings. Organizers and joined players see their matches, while designated super admins can browse all matches. Run `supabase/migration_027_vestiaire_history.sql` so all joined players can see published rankings even if they skipped voting. Individual ballots remain private.

## Player cards

The Players page uses football-style collectible cards. Click a card to submit the required private overall rating (1–10) and optional attack, defense, shooting, passing, dribbling, and pace votes. Each skill has its own playful labels, such as Row Z, Brick wall, Laser vision, or Turbo mode (translated in French). Cards show labels derived from combined skill votes, with no numerical overall score or individual ballots. Unrated skills show Not rated. Skill votes do not affect team balancing. Existing match voting also accepts optional skills; Man of the Match and prediction votes are unchanged.

Run `supabase/migration_024_player_cards.sql` after migration 023 before using the updated app. It adds a separate skill table, private vote policies, label-only card results, and transactional saving. Existing overall ratings are preserved.

## Team generation

The server-side generator uses saved private ratings and assigned positions to prefer balanced teams. It respects team size and separation groups. Every complete team is filled before remaining players go on the bench: in 6v6, 18 players make three teams; 20 make three teams plus two substitutes. At least two full teams are required. A player without ratings receives the default skill value of 5. The method is a balancing heuristic, so equal strength is not guaranteed.

The organizer or a designated super admin can select two or more players in a separation group using selectable cards. Each member of a group must be assigned to a different playing team, or to an available surplus bench place. Impossible combinations fail without changing the saved lineup. Only the organizer and super admins can see or edit these groups. The section stays visible after generation as a read-only list. To change groups in a proposed lineup, open the lineup, choose Back to player setup, edit the groups, and generate teams again. Confirmed teams cannot be reopened. Run `supabase/migration_025_admin_player_separations.sql` to enable super admin separation access. Super admins can also assign positions and generate, reopen, rebalance, or confirm teams without organizing or joining a match. Cancellation, match settings, stadium pins, and scores remain organizer-only.

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
