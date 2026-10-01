-- DANGER: Permanently removes every app user and all app data in this project.
-- Run only in the Supabase SQL Editor for the project you intend to reset.
-- Keeps the schema, policies, functions, and migrations in place.
begin;

-- Remove match-specific data before rosters and matches. The cancellation
-- guard prevents updates, but these deletes do not change match state.
delete from public.match_notifications;
delete from public.match_separation_groups;
delete from public.match_separations;
delete from public.votes;
delete from public.match_results;
delete from public.session_players;
delete from public.sessions;

delete from public.league_players;
delete from public.leagues;
delete from public.player_ratings;
delete from public.stadiums;

-- Profiles reference Auth users. Delete the Auth accounts last so all
-- sign-ins are removed too; the profile FK also cascades on deletion.
delete from public.profiles;
delete from auth.users;

commit;
