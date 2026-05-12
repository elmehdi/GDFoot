-- Migration: Convert num_teams to team_size + bench logic
-- Run this in Supabase SQL Editor if you already have the old schema

-- 1. Add new column
alter table public.sessions add column if not exists team_size integer default 5;

-- 2. Add constraint
alter table public.sessions add constraint sessions_team_size_check
  check (team_size in (5, 6, 8, 11));

-- 3. Drop old column
alter table public.sessions drop column if exists num_teams;

-- 4. Replace generate_teams function with bench logic
-- Teams have EXACTLY team_size players. Leftover players go to bench (team = 0).
create or replace function public.generate_teams(p_session_id uuid)
returns table(player_id uuid, team integer, display_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_size integer;
  v_total_players integer;
  v_num_teams integer;
  v_players_on_teams integer;
  v_player record;
  v_team_totals numeric[];
  v_team_counts integer[];
  v_min_team integer;
  v_min_total numeric;
  v_assigned integer := 0;
  i integer;
begin
  -- Get team size from session
  select s.team_size into v_team_size
  from sessions s
  where s.id = p_session_id;

  if v_team_size is null then
    raise exception 'Session not found';
  end if;

  -- Count total players in session
  select count(*) into v_total_players
  from session_players
  where session_id = p_session_id;

  -- Calculate number of full teams (each exactly team_size players)
  v_num_teams := greatest(2, v_total_players / v_team_size);
  v_players_on_teams := v_num_teams * v_team_size;

  -- Initialize team totals and counts
  v_team_totals := array_fill(0::numeric, array[v_num_teams]);
  v_team_counts := array_fill(0, array[v_num_teams]);

  -- Create temp table with player average scores, sorted descending
  create temp table tmp_players on commit drop as
    select
      sp.player_id,
      p.display_name,
      coalesce(avg(v.score), 5) as avg_score,
      null::integer as assigned_team
    from session_players sp
    join profiles p on p.id = sp.player_id
    left join votes v on v.target_id = sp.player_id and v.session_id = p_session_id
    where sp.session_id = p_session_id
    group by sp.player_id, p.display_name
    order by coalesce(avg(v.score), 5) desc;

  -- Greedy assignment: top players get teams, rest go to bench (team = 0)
  for v_player in select * from tmp_players order by avg_score desc
  loop
    if v_assigned >= v_players_on_teams then
      -- Bench
      update tmp_players set assigned_team = 0
        where tmp_players.player_id = v_player.player_id;
    else
      -- Find team with minimum total that still has room
      v_min_team := null;
      v_min_total := null;
      for i in 1..v_num_teams loop
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

  -- Persist team assignments (0 = bench, 1..N = teams)
  update session_players sp
    set team = tp.assigned_team
    from tmp_players tp
    where sp.player_id = tp.player_id
      and sp.session_id = p_session_id;

  -- Mark session as completed
  update sessions set status = 'completed' where id = p_session_id;

  -- Return team assignments (NO scores!)
  return query
    select tp.player_id, tp.assigned_team as team, tp.display_name
    from tmp_players tp
    order by tp.assigned_team, tp.display_name;
end;
$$;
