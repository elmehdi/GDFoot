-- ============================================================
-- Migration 007: League/Championship System + Global Ratings
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. GLOBAL PLAYER RATINGS (replaces per-session voting)
-- Players rate each other once, can edit anytime
create table if not exists public.player_ratings (
  id uuid default gen_random_uuid() primary key,
  voter_id uuid references public.profiles(id) on delete cascade not null,
  target_id uuid references public.profiles(id) on delete cascade not null,
  score integer not null check (score >= 1 and score <= 10),
  updated_at timestamptz default now() not null,
  unique(voter_id, target_id)
);

alter table public.player_ratings enable row level security;

create policy "Users can see own ratings"
  on public.player_ratings for select
  to authenticated
  using (auth.uid() = voter_id);

create policy "Users can insert ratings"
  on public.player_ratings for insert
  to authenticated
  with check (auth.uid() = voter_id and auth.uid() != target_id);

create policy "Users can update own ratings"
  on public.player_ratings for update
  to authenticated
  using (auth.uid() = voter_id);

create policy "Users can delete own ratings"
  on public.player_ratings for delete
  to authenticated
  using (auth.uid() = voter_id);


-- 2. LEAGUES TABLE
create table if not exists public.leagues (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_by uuid references public.profiles(id) not null,
  team_size integer default 5 check (team_size in (5, 6, 8, 11)) not null,
  status text default 'active' check (status in ('active', 'completed')) not null,
  created_at timestamptz default now() not null
);

alter table public.leagues enable row level security;

create policy "Leagues visible to authenticated users"
  on public.leagues for select
  to authenticated
  using (true);

create policy "Authenticated users can create leagues"
  on public.leagues for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "Creator can update league"
  on public.leagues for update
  to authenticated
  using (auth.uid() = created_by);

create policy "Creator can delete league"
  on public.leagues for delete
  to authenticated
  using (auth.uid() = created_by);


-- 3. LEAGUE PLAYERS
create table if not exists public.league_players (
  id uuid default gen_random_uuid() primary key,
  league_id uuid references public.leagues(id) on delete cascade not null,
  player_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  unique(league_id, player_id)
);

alter table public.league_players enable row level security;

create policy "League players visible to authenticated users"
  on public.league_players for select
  to authenticated
  using (true);

create policy "Players or creator can join leagues"
  on public.league_players for insert
  to authenticated
  with check (
    auth.uid() = player_id
    or exists (
      select 1 from public.leagues l
      where l.id = league_id and l.created_by = auth.uid()
    )
  );

create policy "Players can leave leagues"
  on public.league_players for delete
  to authenticated
  using (
    auth.uid() = player_id
    or exists (
      select 1 from public.leagues l
      where l.id = league_id and l.created_by = auth.uid()
    )
  );


-- 4. ADD league_id TO SESSIONS (optional link)
alter table public.sessions
  add column if not exists league_id uuid references public.leagues(id) on delete set null;


-- 5. MATCH RESULTS - record scores after playing
create table if not exists public.match_results (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.sessions(id) on delete cascade not null unique,
  team_1_goals integer not null default 0 check (team_1_goals >= 0),
  team_2_goals integer not null default 0 check (team_2_goals >= 0),
  recorded_by uuid references public.profiles(id) not null,
  created_at timestamptz default now() not null
);

alter table public.match_results enable row level security;

create policy "Match results visible to authenticated users"
  on public.match_results for select
  to authenticated
  using (true);

create policy "Session creator can record results"
  on public.match_results for insert
  to authenticated
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = session_id and s.created_by = auth.uid()
    )
  );

create policy "Session creator can update results"
  on public.match_results for update
  to authenticated
  using (
    exists (
      select 1 from public.sessions s
      where s.id = session_id and s.created_by = auth.uid()
    )
  );


-- 6. GENERATE TEAMS USING GLOBAL RATINGS
-- New function that uses player_ratings instead of per-session votes
-- Forces exactly 2 teams + bench for league matches
create or replace function public.generate_teams_from_ratings(p_session_id uuid)
returns table(player_id uuid, team integer, display_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_size integer;
  v_total_players integer;
  v_players_on_teams integer;
  v_player record;
  v_team_totals numeric[];
  v_team_counts integer[];
  v_min_team integer;
  v_min_total numeric;
  v_assigned integer := 0;
  i integer;
begin
  select s.team_size into v_team_size
  from sessions s
  where s.id = p_session_id;

  if v_team_size is null then
    raise exception 'Session not found';
  end if;

  select count(*) into v_total_players
  from session_players
  where session_id = p_session_id;

  -- Always 2 teams for balanced play
  v_players_on_teams := 2 * v_team_size;

  v_team_totals := array_fill(0::numeric, array[2]);
  v_team_counts := array_fill(0, array[2]);

  -- Use GLOBAL player_ratings instead of per-session votes
  create temp table tmp_players on commit drop as
    select
      sp.player_id,
      p.display_name,
      coalesce(avg(pr.score), 5) as avg_score,
      coalesce(avg(pr.score), 5) + (random() * 0.4 - 0.2) as sort_score,
      null::integer as assigned_team
    from session_players sp
    join profiles p on p.id = sp.player_id
    left join player_ratings pr on pr.target_id = sp.player_id
    where sp.session_id = p_session_id
    group by sp.player_id, p.display_name;

  for v_player in select * from tmp_players order by sort_score desc
  loop
    if v_assigned >= v_players_on_teams then
      update tmp_players set assigned_team = 0
        where tmp_players.player_id = v_player.player_id;
    else
      v_min_team := null;
      v_min_total := null;
      for i in 1..2 loop
        if v_team_counts[i] < v_team_size then
          if v_min_total is null or v_team_totals[i] < v_min_total then
            v_min_team := i;
            v_min_total := v_team_totals[i];
          end if;
        end if;
      end loop;

      update tmp_players set assigned_team = v_min_team
        where tmp_players.player_id = v_player.player_id;

      v_team_totals[v_min_team] := v_team_totals[v_min_team] + v_player.avg_score;
      v_team_counts[v_min_team] := v_team_counts[v_min_team] + 1;
    end if;

    v_assigned := v_assigned + 1;
  end loop;

  update session_players sp
    set team = tp.assigned_team
    from tmp_players tp
    where sp.player_id = tp.player_id
      and sp.session_id = p_session_id;

  update sessions set status = 'completed' where id = p_session_id;

  return query
    select tp.player_id, tp.assigned_team as team, tp.display_name
    from tmp_players tp
    order by tp.assigned_team, tp.display_name;
end;
$$;


-- 7. LEAGUE STANDINGS FUNCTION
-- Returns per-player standings across all league matches
create or replace function public.get_league_standings(p_league_id uuid)
returns table(
  player_id uuid,
  display_name text,
  played integer,
  won integer,
  drawn integer,
  lost integer,
  goals_for integer,
  goals_against integer,
  goal_difference integer,
  points integer
)
language sql
security definer
set search_path = public
as $$
  with match_player_results as (
    -- For each completed match in the league, determine each player's result
    select
      sp.player_id,
      p.display_name,
      mr.session_id,
      sp.team as player_team,
      case
        when sp.team = 1 then mr.team_1_goals
        when sp.team = 2 then mr.team_2_goals
        else 0
      end as team_goals,
      case
        when sp.team = 1 then mr.team_2_goals
        when sp.team = 2 then mr.team_1_goals
        else 0
      end as opponent_goals
    from sessions s
    join match_results mr on mr.session_id = s.id
    join session_players sp on sp.session_id = s.id and sp.team in (1, 2)
    join profiles p on p.id = sp.player_id
    where s.league_id = p_league_id
  )
  select
    mpr.player_id,
    mpr.display_name,
    count(*)::integer as played,
    count(*) filter (where mpr.team_goals > mpr.opponent_goals)::integer as won,
    count(*) filter (where mpr.team_goals = mpr.opponent_goals)::integer as drawn,
    count(*) filter (where mpr.team_goals < mpr.opponent_goals)::integer as lost,
    coalesce(sum(mpr.team_goals), 0)::integer as goals_for,
    coalesce(sum(mpr.opponent_goals), 0)::integer as goals_against,
    coalesce(sum(mpr.team_goals - mpr.opponent_goals), 0)::integer as goal_difference,
    (count(*) filter (where mpr.team_goals > mpr.opponent_goals) * 3
     + count(*) filter (where mpr.team_goals = mpr.opponent_goals))::integer as points
  from match_player_results mpr
  group by mpr.player_id, mpr.display_name
  order by points desc, goal_difference desc, goals_for desc;
$$;


-- 8. CREATE LEAGUE MATCH DAY
-- Creates a session for a league match day, auto-adds all league players
create or replace function public.create_league_match(p_league_id uuid, p_match_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_team_size integer;
  v_creator uuid;
begin
  select l.team_size, l.created_by into v_team_size, v_creator
  from leagues l
  where l.id = p_league_id;

  if v_team_size is null then
    raise exception 'League not found';
  end if;

  -- Create session linked to league
  insert into sessions (name, created_by, team_size, league_id, status)
  values (p_match_name, v_creator, v_team_size, p_league_id, 'open')
  returning id into v_session_id;

  -- Auto-add all league players to the session
  insert into session_players (session_id, player_id)
  select v_session_id, lp.player_id
  from league_players lp
  where lp.league_id = p_league_id;

  return v_session_id;
end;
$$;


-- 9. UPDATE PROFILE FUNCTION
-- Allow users to update their display name
create or replace function public.update_display_name(p_new_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update profiles set display_name = p_new_name where id = auth.uid();
end;
$$;
