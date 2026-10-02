-- Run after migration_021_vestiaire_notifications.sql.
-- Pickup matches contain a sequence of short games between generated teams.
-- Fixed league fixtures keep using match_results for their standings.
begin;

create table if not exists public.session_games (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  game_number integer not null check (game_number > 0),
  team_a integer not null check (team_a > 0),
  team_b integer not null check (team_b > 0 and team_b <> team_a),
  goals_a integer not null check (goals_a >= 0),
  goals_b integer not null check (goals_b >= 0),
  ended_by text not null check (ended_by in ('time', 'two_goals')),
  recorded_at timestamptz not null default now(),
  unique(session_id, game_number),
  check (ended_by <> 'two_goals' or (goals_a = 2 and goals_b < 2) or (goals_b = 2 and goals_a < 2))
);
create index if not exists session_games_session_idx on public.session_games(session_id, game_number);
alter table public.session_games enable row level security;
drop policy if exists "Authenticated users can view pickup games" on public.session_games;
create policy "Authenticated users can view pickup games" on public.session_games
  for select to authenticated using (true);
revoke all on public.session_games from anon, authenticated;
grant select on public.session_games to authenticated;

create or replace function public.save_session_game(
  p_session_id uuid, p_game_id uuid, p_team_a integer, p_team_b integer,
  p_goals_a integer, p_goals_b integer, p_ended_by text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_session public.sessions%rowtype; v_game_id uuid; v_next_number integer;
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found or auth.uid() is null or v_session.created_by <> auth.uid() then
    raise exception 'Only the match organizer can record games';
  end if;
  if v_session.cancelled_at is not null or not v_session.locked
     or v_session.status <> 'completed' or v_session.league_id is not null then
    raise exception 'Confirm the pickup teams before recording games';
  end if;
  if p_team_a is null or p_team_b is null or p_team_a = p_team_b
     or p_team_a <= 0 or p_team_b <= 0
     or not exists (select 1 from public.session_players sp
       where sp.session_id = p_session_id and sp.team = p_team_a)
     or not exists (select 1 from public.session_players sp
       where sp.session_id = p_session_id and sp.team = p_team_b) then
    raise exception 'Choose two different teams in this match';
  end if;
  if p_goals_a is null or p_goals_b is null or p_goals_a not between 0 and 2
     or p_goals_b not between 0 and 2 or p_ended_by not in ('time', 'two_goals')
     or p_ended_by is null then
    raise exception 'Enter a score from 0 to 2 and how the game ended';
  end if;
  if p_ended_by = 'two_goals' and not (
    (p_goals_a = 2 and p_goals_b < 2) or (p_goals_b = 2 and p_goals_a < 2)
  ) then raise exception 'A two-goal game needs one team to reach two first'; end if;
  if p_ended_by = 'time' and (p_goals_a = 2 or p_goals_b = 2) then
    raise exception 'The game ends as soon as a team reaches two goals';
  end if;

  if p_game_id is null then
    select coalesce(max(game_number), 0) + 1 into v_next_number
      from public.session_games where session_id = p_session_id;
    insert into public.session_games(session_id, game_number, team_a, team_b,
      goals_a, goals_b, ended_by)
      values (p_session_id, v_next_number, p_team_a, p_team_b,
        p_goals_a, p_goals_b, p_ended_by) returning id into v_game_id;
  else
    update public.session_games set team_a = p_team_a, team_b = p_team_b,
      goals_a = p_goals_a, goals_b = p_goals_b, ended_by = p_ended_by,
      recorded_at = now()
      where id = p_game_id and session_id = p_session_id returning id into v_game_id;
    if v_game_id is null then raise exception 'Game not found in this match'; end if;
  end if;
  return v_game_id;
end $$;
revoke all on function public.save_session_game(uuid,uuid,integer,integer,integer,integer,text)
  from public, anon;
grant execute on function public.save_session_game(uuid,uuid,integer,integer,integer,integer,text)
  to authenticated;

-- Preserve older pickup scores as the first recorded short game.
insert into public.session_games(session_id, game_number, team_a, team_b,
  goals_a, goals_b, ended_by, recorded_at)
select mr.session_id, 1, 1, 2, mr.team_1_goals,
  mr.team_2_goals, 'time', mr.created_at
from public.match_results mr join public.sessions s on s.id = mr.session_id
where s.league_id is null
on conflict (session_id, game_number) do nothing;

notify pgrst, 'reload schema';
commit;
