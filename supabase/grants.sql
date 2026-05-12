-- Run this in Supabase SQL Editor to grant API access to your tables
-- (Needed because "Automatically expose new tables" was disabled)

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.sessions to authenticated;
grant select, insert, update, delete on public.session_players to authenticated;
grant select, insert, update, delete on public.votes to authenticated;

-- Allow the anon role to read (needed for pre-auth checks)
grant select on public.profiles to anon;
