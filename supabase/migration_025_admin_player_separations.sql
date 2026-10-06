-- Run after migration_024_player_cards.sql.
-- Match organizers and designated super admins share separation setup access.
begin;

drop policy if exists "Organizer reads separation groups" on public.match_separation_groups;
drop policy if exists "Team managers read separation groups" on public.match_separation_groups;
create policy "Team managers read separation groups"
  on public.match_separation_groups for select to authenticated
  using (public.can_manage_match_teams(session_id));

create or replace function public.save_separation_group(
  p_session_id uuid, p_player_ids uuid[], p_remove_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_session public.sessions%rowtype; v_ids uuid[]; v_id uuid;
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found or not public.can_manage_match_teams(p_session_id) then
    raise exception 'Only the match organizer or a super admin can set player separations';
  end if;
  if v_session.cancelled_at is not null or v_session.locked
    or v_session.status not in ('open', 'voting') or v_session.home_squad is not null then
    raise exception 'Separations can only change before teams are generated';
  end if;
  if p_remove_id is not null then
    delete from public.match_separation_groups where id = p_remove_id and session_id = p_session_id;
    return p_remove_id;
  end if;
  select array_agg(distinct x order by x) into v_ids from unnest(p_player_ids) x where x is not null;
  if coalesce(cardinality(v_ids), 0) < 2 then raise exception 'Select at least two players'; end if;
  if exists (select 1 from unnest(v_ids) x where not exists (
    select 1 from public.session_players sp where sp.session_id = p_session_id and sp.player_id = x
  )) then raise exception 'Every selected player must be in this match'; end if;
  insert into public.match_separation_groups(session_id, player_ids) values(p_session_id, v_ids)
    on conflict(session_id, player_ids) do update set player_ids = excluded.player_ids returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.save_separation_group(uuid,uuid[],uuid) from public, anon;
grant execute on function public.save_separation_group(uuid,uuid[],uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
