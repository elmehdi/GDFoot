-- Run after migration_018_stadium_coordinates.sql.
-- Vestiaire votes never affect player ratings or balanced teams.
begin;

create table if not exists public.vestiaire_rounds (
  session_id uuid primary key references public.sessions(id) on delete cascade,
  predictions_closed boolean not null default false,
  motm_open boolean not null default false,
  motm_closed boolean not null default false,
  updated_at timestamptz not null default now(),
  check (not motm_open or predictions_closed),
  check (not motm_closed or motm_open)
);
alter table public.vestiaire_rounds enable row level security;
drop policy if exists "Authenticated users can view vestiaire phases" on public.vestiaire_rounds;
create policy "Authenticated users can view vestiaire phases"
  on public.vestiaire_rounds for select to authenticated using (true);
revoke all on public.vestiaire_rounds from anon, authenticated;
grant select on public.vestiaire_rounds to authenticated;

create table if not exists public.vestiaire_votes (
  session_id uuid not null references public.sessions(id) on delete cascade,
  question_key text not null check (question_key in
    ('over_wall','late','first_foul','miss_penalty','lost_defender','empty_goal','motm')),
  voter_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (session_id, question_key, voter_id),
  check (voter_id <> target_id)
);
create index if not exists vestiaire_votes_results_idx
  on public.vestiaire_votes(session_id, question_key, target_id);
alter table public.vestiaire_votes enable row level security;
drop policy if exists "Players can view only their own vestiaire votes" on public.vestiaire_votes;
create policy "Players can view only their own vestiaire votes"
  on public.vestiaire_votes for select to authenticated using (voter_id = (select auth.uid()));
revoke all on public.vestiaire_votes from anon, authenticated;
grant select on public.vestiaire_votes to authenticated;

create or replace function public.cast_vestiaire_vote(
  p_session_id uuid, p_question_key text, p_target_id uuid
) returns void language plpgsql security definer set search_path = public as $$
declare v_session public.sessions%rowtype; v_round public.vestiaire_rounds%rowtype;
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found or auth.uid() is null then raise exception 'Match unavailable'; end if;
  if v_session.cancelled_at is not null then raise exception 'Match cancelled'; end if;
  if not exists (select 1 from public.session_players
    where session_id = p_session_id and player_id = auth.uid()) then
    raise exception 'Only joined players can vote';
  end if;
  if p_target_id is null or p_target_id = auth.uid() or not exists (
    select 1 from public.session_players where session_id = p_session_id and player_id = p_target_id
  ) then raise exception 'Choose another player in this match'; end if;
  if p_question_key not in ('over_wall','late','first_foul','miss_penalty',
      'lost_defender','empty_goal','motm') or p_question_key is null then
    raise exception 'Unknown vestiaire question';
  end if;
  select * into v_round from public.vestiaire_rounds where session_id = p_session_id;
  if p_question_key = 'motm' then
    if not coalesce(v_round.motm_open, false) or coalesce(v_round.motm_closed, false) then
      raise exception 'Man of the Match voting is closed';
    end if;
  elsif coalesce(v_round.predictions_closed, false) then
    raise exception 'Predictions are closed';
  end if;
  insert into public.vestiaire_votes(session_id, question_key, voter_id, target_id)
    values (p_session_id, p_question_key, auth.uid(), p_target_id)
    on conflict (session_id, question_key, voter_id)
    do update set target_id = excluded.target_id, updated_at = now();
end $$;
revoke all on function public.cast_vestiaire_vote(uuid,text,uuid) from public, anon;
grant execute on function public.cast_vestiaire_vote(uuid,text,uuid) to authenticated;

create or replace function public.advance_vestiaire_round(p_session_id uuid, p_action text)
returns void language plpgsql security definer set search_path = public as $$
declare v_session public.sessions%rowtype; v_round public.vestiaire_rounds%rowtype;
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found or auth.uid() is null or v_session.created_by <> auth.uid() then
    raise exception 'Only the match organizer can manage vestiaire voting';
  end if;
  if v_session.cancelled_at is not null then raise exception 'Match cancelled'; end if;
  insert into public.vestiaire_rounds(session_id) values(p_session_id) on conflict do nothing;
  select * into v_round from public.vestiaire_rounds where session_id = p_session_id for update;
  if p_action = 'close_predictions' and not v_round.predictions_closed then
    update public.vestiaire_rounds set predictions_closed = true, updated_at = now()
      where session_id = p_session_id;
  elsif p_action = 'open_motm' and v_round.predictions_closed and not v_round.motm_open then
    update public.vestiaire_rounds set motm_open = true, updated_at = now()
      where session_id = p_session_id;
  elsif p_action = 'close_motm' and v_round.motm_open and not v_round.motm_closed then
    update public.vestiaire_rounds set motm_closed = true, updated_at = now()
      where session_id = p_session_id;
  else
    raise exception 'Vestiaire phase cannot advance this way';
  end if;
end $$;
revoke all on function public.advance_vestiaire_round(uuid,text) from public, anon;
grant execute on function public.advance_vestiaire_round(uuid,text) to authenticated;

-- Only ranks and names leave the database: never voter IDs or raw ballots.
-- Results are frozen until the organizer closes Man of the Match voting.
create or replace function public.get_vestiaire_results(p_session_id uuid)
returns table(question_key text, place integer, player_id uuid, display_name text)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.sessions s where s.id = p_session_id
      and (s.created_by = auth.uid() or exists (
        select 1 from public.session_players sp
          where sp.session_id = p_session_id and sp.player_id = auth.uid()))
  ) then raise exception 'Match unavailable'; end if;
  if not exists (select 1 from public.vestiaire_rounds
    where session_id = p_session_id and motm_closed = true) then return; end if;
  return query
    with totals as (
      select v.question_key, v.target_id, count(*) as votes
        from public.vestiaire_votes v where v.session_id = p_session_id
        group by v.question_key, v.target_id
    ), ranked as (
      select t.question_key, t.target_id, p.display_name,
        row_number() over (partition by t.question_key
          order by t.votes desc, p.display_name, t.target_id)::integer as rank_no
      from totals t join public.profiles p on p.id = t.target_id
    )
    select r.question_key, r.rank_no, r.target_id, r.display_name
      from ranked r where r.rank_no <= case when r.question_key = 'motm' then 1 else 3 end
      order by r.question_key, r.rank_no;
end $$;
revoke all on function public.get_vestiaire_results(uuid) from public, anon;
grant execute on function public.get_vestiaire_results(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
