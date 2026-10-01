-- Run after migration_012_separation_groups.sql.
begin;

-- A persistent inbox derived from first sign-in and the viewer's own ratings.
-- No fan-out rows, public scores, or notifications for unconfirmed signups.
create or replace function public.get_pending_player_ratings()
returns table(player_id uuid, display_name text, joined_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select p.id, p.display_name, p.created_at
  from public.profiles p join auth.users u on u.id = p.id
  where auth.uid() is not null and p.id <> auth.uid()
    and u.last_sign_in_at is not null
    and not exists (select 1 from public.player_ratings r
      where r.voter_id = auth.uid() and r.target_id = p.id)
  order by p.created_at desc, p.id;
$$;
revoke all on function public.get_pending_player_ratings() from public, anon;
grant execute on function public.get_pending_player_ratings() to authenticated;

-- Older clients also use saved ratings. Keep historical votes intact.
create or replace function public.generate_teams(p_session_id uuid)
returns table(player_id uuid, team integer, display_name text)
language sql security definer set search_path = public
as $$ select * from public.balance_match_by_position(p_session_id, true); $$;
revoke all on function public.generate_teams(uuid) from public, anon;
grant execute on function public.generate_teams(uuid) to authenticated;
alter table public.sessions alter column rating_source set default 'global';
update public.sessions set status = 'open' where status = 'voting' and not locked;
notify pgrst, 'reload schema';
commit;
