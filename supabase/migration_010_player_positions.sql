-- Run after migration_009_stadiums.sql. Existing players remain flexible.
begin;
alter table public.session_players add column if not exists position text not null default 'any'
  check (position in ('any', 'goalkeeper', 'defender', 'midfielder', 'attacker'));
alter table public.sessions add column if not exists rating_source text not null default 'votes'
  check (rating_source in ('votes', 'global'));

-- A player can read and change only the ratings they submitted.
drop policy if exists "Users can update own ratings" on public.player_ratings;
create policy "Users can update own ratings" on public.player_ratings
  for update to authenticated using (voter_id = (select auth.uid()))
  with check (voter_id = (select auth.uid()) and target_id <> (select auth.uid()));

-- Prevent self-joining players from assigning their own position via the API.
create or replace function public.guard_player_position()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_creator uuid; v_status text; v_locked boolean;
begin
  if (tg_op = 'INSERT' and new.position = 'any') then return new; end if;
  if tg_op = 'UPDATE' then
    if new.position is not distinct from old.position then return new; end if;
  end if;
  select s.created_by, s.status, s.locked into v_creator, v_status, v_locked
    from public.sessions s where s.id = new.session_id for update;
  if auth.uid() is null or auth.uid() <> v_creator then
    raise exception 'Only the match organizer can assign positions';
  end if;
  if v_locked or v_status not in ('open', 'voting') then
    raise exception 'Positions can only change before teams are generated';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_player_position on public.session_players;
create trigger guard_player_position before insert or update of position on public.session_players
  for each row execute function public.guard_player_position();

create or replace function public.set_player_position(p_session_id uuid, p_player_id uuid, p_position text)
returns void language plpgsql security definer set search_path = public
as $$
declare v_session public.sessions%rowtype;
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found or auth.uid() is null or v_session.created_by <> auth.uid() then
    raise exception 'Only the match organizer can assign positions';
  end if;
  if v_session.locked or v_session.status not in ('open', 'voting') then
    raise exception 'Positions can only change before teams are generated';
  end if;
  if p_position is null or p_position not in ('any','goalkeeper','defender','midfielder','attacker') then
    raise exception 'Invalid position';
  end if;
  update public.session_players set position = p_position
    where session_id = p_session_id and player_id = p_player_id;
  if not found then raise exception 'Player is not in this match'; end if;
end;
$$;

-- Private engine: position counts are balanced first, then total skill.
-- No ratings or aggregates are returned to the client.
create or replace function public.balance_match_by_position(p_session_id uuid, p_use_global boolean)
returns table(player_id uuid, team integer, display_name text)
language plpgsql security definer set search_path = public
as $$
declare
  v_session public.sessions%rowtype;
  v_total integer; v_num_teams integer; v_capacity integer; v_assigned integer := 0;
  v_totals numeric[]; v_counts integer[]; v_positions integer[][];
  v_player record; v_best integer; v_role integer; v_role_count integer; v_best_role_count integer;
  i integer;
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found or auth.uid() is null or v_session.created_by <> auth.uid() then
    raise exception 'Only the match organizer can generate teams';
  end if;
  if v_session.locked then raise exception 'Teams are already confirmed'; end if;
  if v_session.league_id is not null and v_session.home_squad is not null then
    raise exception 'Fixed league squads cannot be rebalanced for one match';
  end if;
  select count(*) into v_total from public.session_players sp where sp.session_id = p_session_id;
  if v_total < 2 * v_session.team_size then raise exception 'Not enough players for two full teams'; end if;
  v_num_teams := case when p_use_global then 2 else greatest(2, v_total / v_session.team_size) end;
  v_capacity := v_num_teams * v_session.team_size;
  v_totals := array_fill(0::numeric, array[v_num_teams]);
  v_counts := array_fill(0, array[v_num_teams]);
  v_positions := array_fill(0, array[v_num_teams, 4]);

  for v_player in
    select scored.* from (select sp.player_id, sp.position,
      case sp.position when 'goalkeeper' then 1 when 'defender' then 2 when 'midfielder' then 3 when 'attacker' then 4 else 5 end as role_index,
      coalesce(case when p_use_global
        then (select avg(pr.score) from public.player_ratings pr where pr.target_id = sp.player_id)
        else (select avg(v.score) from public.votes v where v.session_id = p_session_id and v.target_id = sp.player_id)
      end, 5) as skill
    from public.session_players sp where sp.session_id = p_session_id
    ) scored order by scored.role_index, scored.skill + random() * 0.4 desc, scored.player_id
  loop
    v_best := null;
    if v_assigned < v_capacity then
      v_role := v_player.role_index;
      v_best_role_count := null;
      for i in 1..v_num_teams loop
        if v_counts[i] < v_session.team_size then
          v_role_count := case when v_role <= 4 then v_positions[i][v_role] else 0 end;
          if v_best is null or v_role_count < v_best_role_count
             or (v_role_count = v_best_role_count and v_totals[i] < v_totals[v_best])
             or (v_role_count = v_best_role_count and v_totals[i] = v_totals[v_best] and v_counts[i] < v_counts[v_best]) then
            v_best := i; v_best_role_count := v_role_count;
          end if;
        end if;
      end loop;
      v_counts[v_best] := v_counts[v_best] + 1;
      v_totals[v_best] := v_totals[v_best] + v_player.skill;
      if v_role <= 4 then v_positions[v_best][v_role] := v_positions[v_best][v_role] + 1; end if;
    end if;
    update public.session_players sp set team = coalesce(v_best, 0)
      where sp.session_id = p_session_id and sp.player_id = v_player.player_id;
    v_assigned := v_assigned + 1;
  end loop;
  update public.sessions set status = 'completed', rating_source = case when p_use_global then 'global' else 'votes' end where id = p_session_id;
  return query select sp.player_id, sp.team, p.display_name
    from public.session_players sp join public.profiles p on p.id = sp.player_id
    where sp.session_id = p_session_id order by sp.team, p.display_name;
end;
$$;

create or replace function public.generate_teams(p_session_id uuid)
returns table(player_id uuid, team integer, display_name text)
language sql security definer set search_path = public
as $$ select * from public.balance_match_by_position(p_session_id, false); $$;
create or replace function public.generate_teams_from_ratings(p_session_id uuid)
returns table(player_id uuid, team integer, display_name text)
language sql security definer set search_path = public
as $$ select * from public.balance_match_by_position(p_session_id, true); $$;

revoke all on function public.guard_player_position() from public, anon, authenticated;
revoke all on function public.balance_match_by_position(uuid, boolean) from public, anon, authenticated;
revoke all on function public.set_player_position(uuid, uuid, text) from public, anon;
revoke all on function public.generate_teams(uuid) from public, anon;
revoke all on function public.generate_teams_from_ratings(uuid) from public, anon;
grant execute on function public.set_player_position(uuid, uuid, text) to authenticated;
grant execute on function public.generate_teams(uuid) to authenticated;
grant execute on function public.generate_teams_from_ratings(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
