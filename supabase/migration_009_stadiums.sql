-- Run after migration_008_fixed_squads.sql in the Supabase SQL Editor.
-- Existing matches retain a null stadium until an organizer chooses one.
begin;

create table if not exists public.stadiums (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name = btrim(name) and char_length(name) between 1 and 120),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create unique index if not exists stadiums_name_unique
  on public.stadiums (lower(regexp_replace(name, '\s+', ' ', 'g')));

alter table public.stadiums enable row level security;
drop policy if exists "Authenticated users can view stadiums" on public.stadiums;
create policy "Authenticated users can view stadiums"
  on public.stadiums for select to authenticated using (true);
drop policy if exists "Authenticated users can add stadiums" on public.stadiums;
create policy "Authenticated users can add stadiums"
  on public.stadiums for insert to authenticated
  with check (created_by = (select auth.uid()));

grant select, insert on public.stadiums to authenticated;

alter table public.sessions add column if not exists stadium_id uuid
  references public.stadiums(id);
create index if not exists sessions_stadium_id_idx on public.sessions(stadium_id);

-- The five-argument overload preserves existing four-argument clients.
-- Creating the fixture and saving its stadium are one transaction.
create or replace function public.create_league_match(
  p_league_id uuid, p_match_name text, p_home_squad integer,
  p_away_squad integer, p_stadium_id uuid
)
returns uuid language plpgsql security invoker set search_path = public
as $$
declare v_session_id uuid;
begin
  if not exists (
    select 1 from public.leagues
    where id = p_league_id and created_by = auth.uid() and status = 'active'
  ) then
    raise exception 'Only the organizer can create a match in an active league';
  end if;
  if p_home_squad is null or p_away_squad is null or p_home_squad = p_away_squad
     or not exists (select 1 from public.league_players where league_id = p_league_id and squad = p_home_squad)
     or not exists (select 1 from public.league_players where league_id = p_league_id and squad = p_away_squad) then
    raise exception 'Choose two different existing squads';
  end if;
  v_session_id := public.create_league_match(p_league_id, p_match_name, p_home_squad, p_away_squad);
  update public.sessions set stadium_id = p_stadium_id where id = v_session_id;
  return v_session_id;
end;
$$;

revoke all on function public.create_league_match(uuid, text, integer, integer, uuid) from public;
grant execute on function public.create_league_match(uuid, text, integer, integer, uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
