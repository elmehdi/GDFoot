-- Run after migration_017_team_ready_notifications.sql.
begin;
alter table public.stadiums add column if not exists latitude numeric(9,6);
alter table public.stadiums add column if not exists longitude numeric(9,6);
do $$ begin
  if not exists (select 1 from pg_constraint
    where conname = 'stadiums_coordinates_pair_check'
      and conrelid = 'public.stadiums'::regclass) then
    alter table public.stadiums add constraint stadiums_coordinates_pair_check
      check ((latitude is null and longitude is null) or
        (latitude between -90 and 90 and longitude between -180 and 180));
  end if;
end $$;
drop policy if exists "Stadium creator can place map pin" on public.stadiums;
create policy "Stadium creator can place map pin" on public.stadiums
  for update to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));
grant update(latitude, longitude) on public.stadiums to authenticated;

-- A match organizer may place the first pin for a stadium used by their
-- match. Only the stadium creator may move an existing pin.
create or replace function public.set_match_stadium_pin(
  p_session_id uuid, p_latitude numeric, p_longitude numeric
) returns void language plpgsql security definer set search_path = public as $$
declare v_stadium_id uuid; v_creator uuid; v_cancelled_at timestamptz;
        v_stadium_creator uuid; v_old_latitude numeric;
begin
  if p_latitude is null or p_longitude is null or
     p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'Choose a valid map location';
  end if;
  select stadium_id, created_by, cancelled_at
    into v_stadium_id, v_creator, v_cancelled_at
    from public.sessions where id = p_session_id for update;
  if not found or auth.uid() is null or v_creator <> auth.uid() then
    raise exception 'Only the match organizer can place this pin';
  end if;
  if v_cancelled_at is not null or v_stadium_id is null then
    raise exception 'Choose a stadium for an active match';
  end if;
  select created_by, latitude into v_stadium_creator, v_old_latitude
    from public.stadiums where id = v_stadium_id for update;
  if v_old_latitude is not null and v_stadium_creator <> auth.uid() then
    raise exception 'Only the stadium creator can move its pin';
  end if;
  update public.stadiums set latitude = p_latitude, longitude = p_longitude
    where id = v_stadium_id;
end $$;
revoke all on function public.set_match_stadium_pin(uuid,numeric,numeric) from public, anon;
grant execute on function public.set_match_stadium_pin(uuid,numeric,numeric) to authenticated;
notify pgrst, 'reload schema';
commit;
