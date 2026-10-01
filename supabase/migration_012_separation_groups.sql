-- Run after migration_011_match_separations.sql.
begin;
create table if not exists public.match_separation_groups (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  player_ids uuid[] not null check (cardinality(player_ids) >= 2),
  unique(session_id, player_ids)
);
alter table public.match_separation_groups enable row level security;
drop policy if exists "Organizer reads separation groups" on public.match_separation_groups;
create policy "Organizer reads separation groups" on public.match_separation_groups for select to authenticated
using (exists(select 1 from public.sessions s where s.id = session_id and s.created_by = (select auth.uid())));
revoke all on public.match_separation_groups from anon,authenticated;
grant select on public.match_separation_groups to authenticated;

create or replace function public.save_separation_group(p_session_id uuid, p_player_ids uuid[], p_remove_id uuid default null)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_session public.sessions%rowtype; v_ids uuid[]; v_id uuid;
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found or auth.uid() is null or v_session.created_by <> auth.uid() then raise exception 'Only the match organizer can set player separations'; end if;
  if v_session.locked or v_session.status not in ('open','voting') or v_session.home_squad is not null then raise exception 'Separations can only change before teams are generated'; end if;
  if p_remove_id is not null then
    delete from public.match_separation_groups where id = p_remove_id and session_id = p_session_id;
    return p_remove_id;
  end if;
  select array_agg(distinct x order by x) into v_ids from unnest(p_player_ids) x where x is not null;
  if coalesce(cardinality(v_ids),0) < 2 then raise exception 'Select at least two players'; end if;
  if exists(select 1 from unnest(v_ids) x where not exists(select 1 from public.session_players sp where sp.session_id = p_session_id and sp.player_id = x)) then raise exception 'Every selected player must be in this match'; end if;
  insert into public.match_separation_groups(session_id,player_ids) values(p_session_id,v_ids)
    on conflict(session_id,player_ids) do update set player_ids = excluded.player_ids returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.save_separation_group(uuid,uuid[],uuid) from public,anon;
grant execute on function public.save_separation_group(uuid,uuid[],uuid) to authenticated;

-- Old pair settings become groups of two, preserving their meaning.
insert into public.match_separation_groups(session_id,player_ids)
select session_id,array[player_a,player_b] from public.match_separations on conflict do nothing;
delete from public.match_separations;

-- Keep the older RPC compatible with groups of two.
create or replace function public.set_match_separation(p_session_id uuid,p_player_a uuid,p_player_b uuid,p_separate boolean)
returns void language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  if p_player_a is null or p_player_b is null or p_player_a = p_player_b or p_separate is null then raise exception 'Choose two different players'; end if;
  if p_separate then perform public.save_separation_group(p_session_id,array[p_player_a,p_player_b]);
  else
    select id into v_id from public.match_separation_groups where session_id = p_session_id and player_ids = array[least(p_player_a,p_player_b),greatest(p_player_a,p_player_b)];
    -- Always call the checked function, even if the group does not exist.
    perform public.save_separation_group(p_session_id,null,coalesce(v_id,'00000000-0000-0000-0000-000000000000'::uuid));
  end if;
end;
$$;

-- Membership changes remove stale group members. Deduplicate groups if needed.
create or replace function public.clean_separation_groups()
returns trigger language plpgsql security definer set search_path = public
as $$
declare g record; remaining uuid[];
begin
  for g in select * from public.match_separation_groups where session_id = old.session_id and old.player_id = any(player_ids) loop
    remaining := array_remove(g.player_ids,old.player_id);
    if cardinality(remaining) < 2 or exists(select 1 from public.match_separation_groups where session_id = g.session_id and player_ids = remaining and id <> g.id) then
      delete from public.match_separation_groups where id = g.id;
    else update public.match_separation_groups set player_ids = remaining where id = g.id; end if;
  end loop;
  return old;
end;
$$;
drop trigger if exists clean_separation_groups on public.session_players;
create trigger clean_separation_groups after delete on public.session_players for each row execute function public.clean_separation_groups();
revoke all on function public.clean_separation_groups() from public,anon,authenticated;

-- Private expanded edges let the existing solver enforce every member of a group.
create or replace view public.match_separation_edges as
select distinct g.session_id,a.player_id player_a,b.player_id player_b
from public.match_separation_groups g
cross join lateral unnest(g.player_ids) a(player_id)
cross join lateral unnest(g.player_ids) b(player_id)
where a.player_id < b.player_id;
revoke all on public.match_separation_edges from public,anon,authenticated;

create or replace function public.balance_match_by_position(p_session_id uuid, p_use_global boolean)
returns table(player_id uuid, team integer, display_name text)
language plpgsql security definer set search_path = public
as $$
declare
  v_session public.sessions%rowtype;
  v_ids uuid[]; v_roles integer[]; v_skills numeric[];
  v_n integer; v_teams integer; v_bench_limit integer; v_bench integer := 0;
  v_edges boolean[][]; v_assign integer[]; v_counts integer[]; v_totals numeric[]; v_roles_count integer[][];
  v_options integer[][]; v_option_count integer[]; v_cursor integer[];
  v_depth integer := 1; v_steps integer := 0; v_choice integer; v_valid boolean;
  v_pair record; v_a integer; v_b integer; i integer; j integer; v_candidate record;
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found or auth.uid() is null or v_session.created_by <> auth.uid() then
    raise exception 'Only the match organizer can generate teams';
  end if;
  if v_session.locked then raise exception 'Teams are already confirmed'; end if;
  if v_session.league_id is not null and v_session.home_squad is not null then
    raise exception 'Fixed league squads cannot be rebalanced for one match';
  end if;

  select array_agg(x.player_id order by x.degree desc,x.role,x.skill desc,x.player_id),
         array_agg(x.role order by x.degree desc,x.role,x.skill desc,x.player_id),
         array_agg(x.skill order by x.degree desc,x.role,x.skill desc,x.player_id)
    into v_ids,v_roles,v_skills
  from (
    select sp.player_id,
      (select count(*) from public.match_separation_edges ms where ms.session_id = p_session_id and sp.player_id in (ms.player_a,ms.player_b)) degree,
      case sp.position when 'goalkeeper' then 1 when 'defender' then 2 when 'midfielder' then 3 when 'attacker' then 4 else 5 end role,
      coalesce(case when p_use_global then (select avg(pr.score) from public.player_ratings pr where pr.target_id = sp.player_id)
        else (select avg(v.score) from public.votes v where v.session_id = p_session_id and v.target_id = sp.player_id) end,5) + random()*0.4 skill
    from public.session_players sp where sp.session_id = p_session_id
  ) x;
  v_n := coalesce(array_length(v_ids,1),0);
  if v_n < 2*v_session.team_size then raise exception 'Not enough players for two full teams'; end if;
  v_teams := case when p_use_global then 2 else greatest(2,v_n/v_session.team_size) end;
  v_bench_limit := v_n-v_teams*v_session.team_size;
  v_assign := array_fill(0,array[v_n]);
  v_counts := array_fill(0,array[v_teams]); v_totals := array_fill(0::numeric,array[v_teams]);
  v_roles_count := array_fill(0,array[v_teams,5]);
  v_edges := array_fill(false,array[v_n,v_n]);
  v_options := array_fill(0,array[v_n,v_teams+1]);
  v_option_count := array_fill(0,array[v_n]); v_cursor := array_fill(0,array[v_n]);
  for v_pair in select * from public.match_separation_edges where session_id = p_session_id loop
    v_a := array_position(v_ids,v_pair.player_a); v_b := array_position(v_ids,v_pair.player_b);
    if v_a is not null and v_b is not null then v_edges[v_a][v_b] := true; v_edges[v_b][v_a] := true; end if;
  end loop;
  while v_depth > 0 and v_depth <= v_n loop
    v_steps := v_steps+1;
    if v_steps > 200000 then raise exception 'SEPARATION_SEARCH_LIMIT'; end if;
    if v_cursor[v_depth] = 0 then
      -- Rebuild choices when arriving from a different assignment prefix.
      v_option_count[v_depth] := 0;
      for v_candidate in select g as candidate from generate_series(1,v_teams) g
        where v_counts[g] < v_session.team_size
        order by case when v_roles[v_depth] < 5 then v_roles_count[g][v_roles[v_depth]] else 0 end,
          v_totals[g],v_counts[g],g
      loop
        v_valid := true;
        for j in 1..v_depth-1 loop
          if v_edges[v_depth][j] and v_assign[j] = v_candidate.candidate then v_valid := false; exit; end if;
        end loop;
        if v_valid then
          v_option_count[v_depth] := v_option_count[v_depth]+1;
          v_options[v_depth][v_option_count[v_depth]] := v_candidate.candidate;
        end if;
      end loop;
      if v_bench < v_bench_limit then
        v_option_count[v_depth] := v_option_count[v_depth]+1;
        v_options[v_depth][v_option_count[v_depth]] := 0;
      end if;
    end if;
    v_cursor[v_depth] := v_cursor[v_depth]+1;
    if v_cursor[v_depth] > v_option_count[v_depth] then
      v_cursor[v_depth] := 0;
      v_depth := v_depth-1;
      if v_depth = 0 then exit; end if;
      v_choice := v_assign[v_depth];
      if v_choice = 0 then v_bench := v_bench-1;
      else
        v_counts[v_choice] := v_counts[v_choice]-1;
        v_totals[v_choice] := v_totals[v_choice]-v_skills[v_depth];
        v_roles_count[v_choice][v_roles[v_depth]] := v_roles_count[v_choice][v_roles[v_depth]]-1;
      end if;
      v_assign[v_depth] := 0;
    else
      v_choice := v_options[v_depth][v_cursor[v_depth]];
      v_assign[v_depth] := v_choice;
      if v_choice = 0 then v_bench := v_bench+1;
      else
        v_counts[v_choice] := v_counts[v_choice]+1;
        v_totals[v_choice] := v_totals[v_choice]+v_skills[v_depth];
        v_roles_count[v_choice][v_roles[v_depth]] := v_roles_count[v_choice][v_roles[v_depth]]+1;
      end if;
      v_depth := v_depth+1;
      if v_depth <= v_n then v_cursor[v_depth] := 0; end if;
    end if;
  end loop;
  if v_depth = 0 then raise exception 'SEPARATION_NO_SOLUTION'; end if;
  for i in 1..v_n loop
    update public.session_players sp set team = v_assign[i] where sp.session_id = p_session_id and sp.player_id = v_ids[i];
  end loop;
  update public.sessions set status = 'completed', rating_source = case when p_use_global then 'global' else 'votes' end where id = p_session_id;
  return query select sp.player_id,sp.team,p.display_name from public.session_players sp join public.profiles p on p.id = sp.player_id
    where sp.session_id = p_session_id order by sp.team,p.display_name;
end;
$$;
revoke all on function public.balance_match_by_position(uuid,boolean) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
