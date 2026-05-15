-- ============================================================
-- Migration 008: Fixed League Squads
-- Squads are generated ONCE and stay the same for the whole season
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add squad assignment to league_players
-- null = not yet assigned, 1,2,3... = squad number
alter table public.league_players
  add column if not exists squad integer;

-- 2. Add home/away squad tracking to sessions (for league matches)
alter table public.sessions
  add column if not exists home_squad integer,
  add column if not exists away_squad integer;

-- 3. GENERATE FIXED SQUADS FOR A LEAGUE (run once)
-- Balanced squads using global ratings, assigned permanently
create or replace function public.generate_league_squads(p_league_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_size integer;
  v_total_players integer;
  v_num_squads integer;
  v_player record;
  v_squad_totals numeric[];
  v_squad_counts integer[];
  v_min_squad integer;
  v_min_total numeric;
  i integer;
begin
  -- Get league team size
  select l.team_size into v_team_size
  from leagues l where l.id = p_league_id;

  if v_team_size is null then
    raise exception 'League not found';
  end if;

  -- Count players
  select count(*) into v_total_players
  from league_players where league_id = p_league_id;

  -- Calculate number of squads (minimum 2)
  v_num_squads := greatest(2, v_total_players / v_team_size);

  -- Initialize arrays
  v_squad_totals := array_fill(0::numeric, array[v_num_squads]);
  v_squad_counts := array_fill(0, array[v_num_squads]);

  -- Reset existing squad assignments
  update league_players set squad = null where league_id = p_league_id;

  -- Greedy balanced assignment using global ratings
  for v_player in
    select
      lp.id as lp_id,
      lp.player_id,
      coalesce(avg(pr.score), 5) as avg_score,
      coalesce(avg(pr.score), 5) + (random() * 0.4 - 0.2) as sort_score
    from league_players lp
    left join player_ratings pr on pr.target_id = lp.player_id
    where lp.league_id = p_league_id
    group by lp.id, lp.player_id
    order by sort_score desc
  loop
    -- Find squad with minimum total that still has room
    v_min_squad := null;
    v_min_total := null;
    for i in 1..v_num_squads loop
      if v_squad_counts[i] < v_team_size then
        if v_min_total is null or v_squad_totals[i] < v_min_total then
          v_min_squad := i;
          v_min_total := v_squad_totals[i];
        end if;
      end if;
    end loop;

    -- If all squads full, put in the smallest squad anyway (overflow)
    if v_min_squad is null then
      v_min_squad := 1;
      v_min_total := v_squad_totals[1];
      for i in 2..v_num_squads loop
        if v_squad_totals[i] < v_min_total then
          v_min_squad := i;
          v_min_total := v_squad_totals[i];
        end if;
      end loop;
    end if;

    -- Assign player to squad
    update league_players set squad = v_min_squad
      where id = v_player.lp_id;

    v_squad_totals[v_min_squad] := v_squad_totals[v_min_squad] + v_player.avg_score;
    v_squad_counts[v_min_squad] := v_squad_counts[v_min_squad] + 1;
  end loop;
end;
$$;


-- 4. CREATE LEAGUE MATCH (updated: between two specific squads)
create or replace function public.create_league_match(
  p_league_id uuid,
  p_match_name text,
  p_home_squad integer default 1,
  p_away_squad integer default 2
)
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
  from leagues l where l.id = p_league_id;

  if v_team_size is null then
    raise exception 'League not found';
  end if;

  -- Create session linked to league with squad info
  insert into sessions (name, created_by, team_size, league_id, status, home_squad, away_squad)
  values (p_match_name, v_creator, v_team_size, p_league_id, 'completed', p_home_squad, p_away_squad)
  returning id into v_session_id;

  -- Add home squad players as team 1
  insert into session_players (session_id, player_id, team)
  select v_session_id, lp.player_id, 1
  from league_players lp
  where lp.league_id = p_league_id and lp.squad = p_home_squad;

  -- Add away squad players as team 2
  insert into session_players (session_id, player_id, team)
  select v_session_id, lp.player_id, 2
  from league_players lp
  where lp.league_id = p_league_id and lp.squad = p_away_squad;

  return v_session_id;
end;
$$;


-- 5. LEAGUE STANDINGS (updated: per-SQUAD, not per-player)
-- Must drop first because return type changed
drop function if exists public.get_league_standings(uuid);
create or replace function public.get_league_standings(p_league_id uuid)
returns table(
  squad_number integer,
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
  with squad_match_results as (
    select
      s.home_squad as squad,
      mr.team_1_goals as gf,
      mr.team_2_goals as ga
    from sessions s
    join match_results mr on mr.session_id = s.id
    where s.league_id = p_league_id and s.home_squad is not null

    union all

    select
      s.away_squad as squad,
      mr.team_2_goals as gf,
      mr.team_1_goals as ga
    from sessions s
    join match_results mr on mr.session_id = s.id
    where s.league_id = p_league_id and s.away_squad is not null
  )
  select
    smr.squad as squad_number,
    count(*)::integer as played,
    count(*) filter (where smr.gf > smr.ga)::integer as won,
    count(*) filter (where smr.gf = smr.ga)::integer as drawn,
    count(*) filter (where smr.gf < smr.ga)::integer as lost,
    coalesce(sum(smr.gf), 0)::integer as goals_for,
    coalesce(sum(smr.ga), 0)::integer as goals_against,
    coalesce(sum(smr.gf - smr.ga), 0)::integer as goal_difference,
    (count(*) filter (where smr.gf > smr.ga) * 3
     + count(*) filter (where smr.gf = smr.ga))::integer as points
  from squad_match_results smr
  group by smr.squad
  order by points desc, goal_difference desc, goals_for desc;
$$;
