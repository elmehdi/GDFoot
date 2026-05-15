-- Run this in Supabase SQL Editor
-- Grants API access for the new league system tables

grant select, insert, update, delete on public.leagues to authenticated;
grant select, insert, update, delete on public.league_players to authenticated;
grant select, insert, update, delete on public.player_ratings to authenticated;
grant select, insert, update, delete on public.match_results to authenticated;
