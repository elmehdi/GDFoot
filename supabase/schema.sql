-- ============================================================
-- Fair Foot - Database Schema
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. PROFILES TABLE
-- Stores player display info, linked to Supabase auth
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text not null,
  avatar_url text,
  created_at timestamptz default now() not null
);

alter table public.profiles enable row level security;

-- Everyone can see profiles
create policy "Profiles are visible to all authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

-- Users can only update their own profile
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- Users can insert their own profile (on signup)
create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);


-- 2. SESSIONS TABLE
-- A "match day" session where players join and vote
create table public.sessions (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_by uuid references public.profiles(id) not null,
  status text default 'open' check (status in ('open', 'voting', 'completed')) not null,
  team_size integer default 5 check (team_size in (5, 6, 8, 11)) not null,
  created_at timestamptz default now() not null
);

alter table public.sessions enable row level security;

create policy "Sessions visible to authenticated users"
  on public.sessions for select
  to authenticated
  using (true);

create policy "Authenticated users can create sessions"
  on public.sessions for insert
  to authenticated
  with check (auth.uid() = created_by);

-- Only the creator can update session (e.g. change status)
create policy "Creator can update session"
  on public.sessions for update
  to authenticated
  using (auth.uid() = created_by);

-- Only the creator can delete a session
create policy "Creator can delete session"
  on public.sessions for delete
  to authenticated
  using (auth.uid() = created_by);


-- 3. SESSION_PLAYERS TABLE
-- Tracks which players joined a session and their team assignment
create table public.session_players (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.sessions(id) on delete cascade not null,
  player_id uuid references public.profiles(id) on delete cascade not null,
  team integer,
  created_at timestamptz default now() not null,
  unique(session_id, player_id)
);

alter table public.session_players enable row level security;

create policy "Session players visible to authenticated users"
  on public.session_players for select
  to authenticated
  using (true);

create policy "Players can join sessions"
  on public.session_players for insert
  to authenticated
  with check (auth.uid() = player_id);

create policy "Players can leave sessions"
  on public.session_players for delete
  to authenticated
  using (auth.uid() = player_id);


-- 4. VOTES TABLE
-- Anonymous votes: only the voter can see their own votes
-- Scores are NEVER exposed to other users
create table public.votes (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.sessions(id) on delete cascade not null,
  voter_id uuid references public.profiles(id) on delete cascade not null,
  target_id uuid references public.profiles(id) on delete cascade not null,
  score integer not null check (score >= 1 and score <= 10),
  created_at timestamptz default now() not null,
  unique(session_id, voter_id, target_id)
);

alter table public.votes enable row level security;

-- CRITICAL: Users can ONLY see their own votes (anonymity)
create policy "Users can only see own votes"
  on public.votes for select
  to authenticated
  using (auth.uid() = voter_id);

-- Users can insert votes for others (not for themselves)
create policy "Users can cast votes"
  on public.votes for insert
  to authenticated
  with check (
    auth.uid() = voter_id
    and auth.uid() != target_id
  );

-- Users can update their own votes
create policy "Users can update own votes"
  on public.votes for update
  to authenticated
  using (auth.uid() = voter_id);


-- 5. SERVER-SIDE FUNCTION: Generate balanced teams
-- This runs with SECURITY DEFINER so it can read all votes
-- but it only returns team assignments, NEVER individual scores
-- Teams have EXACTLY team_size players. Leftover players go to bench (team = 0).
-- Bench players are the lowest-rated who didn't make the cut.
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

  -- Create temp table with player average scores
  -- Small random jitter allows re-shuffling while keeping balance
  create temp table tmp_players on commit drop as
    select
      sp.player_id,
      p.display_name,
      coalesce(avg(v.score), 5) as avg_score,
      coalesce(avg(v.score), 5) + (random() * 0.4 - 0.2) as sort_score,
      null::integer as assigned_team
    from session_players sp
    join profiles p on p.id = sp.player_id
    left join votes v on v.target_id = sp.player_id and v.session_id = p_session_id
    where sp.session_id = p_session_id
    group by sp.player_id, p.display_name;

  -- Greedy assignment: assign top players to teams, rest go to bench
  -- Only the top v_players_on_teams players get assigned to teams
  for v_player in select * from tmp_players order by sort_score desc
  loop
    if v_assigned >= v_players_on_teams then
      -- This player goes to bench (team = 0)
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

      -- Assign player to that team
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


-- 6. HELPER: Check vote status for a player in a session
create or replace function public.get_my_vote_status(p_session_id uuid, p_voter_id uuid)
returns table(target_id uuid, has_voted boolean)
language sql
security definer
set search_path = public
as $$
  select
    sp.player_id as target_id,
    exists(
      select 1 from votes v
      where v.session_id = p_session_id
        and v.voter_id = p_voter_id
        and v.target_id = sp.player_id
    ) as has_voted
  from session_players sp
  where sp.session_id = p_session_id
    and sp.player_id != p_voter_id;
$$;


-- 7. HELPER: Count distinct voters in a session (no scores exposed)
create or replace function public.get_vote_progress(p_session_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select count(distinct voter_id)::integer
  from votes
  where session_id = p_session_id;
$$;


-- 8. AUTO-CREATE PROFILE ON SIGNUP
-- Trigger to auto-create a profile when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
