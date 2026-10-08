-- Run after migration_025_admin_player_separations.sql.
begin;

create or replace function public.is_match_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.match_super_admins where user_id = auth.uid()
  );
$$;
revoke all on function public.is_match_super_admin() from public, anon;
grant execute on function public.is_match_super_admin() to authenticated;

create or replace function public.advance_vestiaire_round(p_session_id uuid, p_action text)
returns void language plpgsql security definer set search_path = public as $$
declare v_session public.sessions%rowtype; v_round public.vestiaire_rounds%rowtype;
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found or not public.can_manage_match_teams(p_session_id) then
    raise exception 'Only the organizer or a super admin can manage voting';
  end if;
  if v_session.cancelled_at is not null then raise exception 'Match cancelled'; end if;
  insert into public.vestiaire_rounds(session_id) values(p_session_id) on conflict do nothing;
  select * into v_round from public.vestiaire_rounds where session_id = p_session_id for update;
  if p_action = 'end_match' then
    if v_session.status <> 'completed' then raise exception 'Generate teams before ending the match'; end if;
    -- Idempotent: another manager finishing the same match never duplicates notices.
    if v_round.motm_open then return; end if;
    update public.vestiaire_rounds set predictions_closed = true, motm_open = true, updated_at = now()
      where session_id = p_session_id;
  elsif p_action = 'close_predictions' and not v_round.predictions_closed then
    update public.vestiaire_rounds set predictions_closed = true, updated_at = now() where session_id = p_session_id;
  elsif p_action = 'open_motm' and v_round.predictions_closed and not v_round.motm_open then
    update public.vestiaire_rounds set motm_open = true, updated_at = now() where session_id = p_session_id;
  elsif p_action = 'close_motm' and v_round.motm_open and not v_round.motm_closed then
    update public.vestiaire_rounds set motm_closed = true, updated_at = now() where session_id = p_session_id;
  else raise exception 'Vestiaire phase cannot advance this way';
  end if;
end;
$$;
revoke all on function public.advance_vestiaire_round(uuid,text) from public, anon;
grant execute on function public.advance_vestiaire_round(uuid,text) to authenticated;

create table public.team_feedback (
  session_id uuid not null references public.sessions(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  response text not null check (response in ('happy', 'mixed', 'unhappy', 'skipped')),
  comment text not null default '' check (length(comment) <= 500),
  updated_at timestamptz not null default now(),
  primary key (session_id, player_id)
);
alter table public.team_feedback enable row level security;
create policy "Players read own feedback" on public.team_feedback
  for select to authenticated using (player_id = auth.uid());
revoke all on public.team_feedback from anon, authenticated;
grant select on public.team_feedback to authenticated;

alter table public.match_notifications drop constraint if exists match_notifications_kind_check;
alter table public.match_notifications add constraint match_notifications_kind_check
  check (kind in ('cancelled', 'ready', 'vestiaire_predictions', 'vestiaire_motm', 'team_feedback'));

create or replace function public.save_team_feedback(p_session_id uuid, p_response text, p_comment text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  perform 1 from public.sessions where id = p_session_id and cancelled_at is null for update;
  if not found or auth.uid() is null then raise exception 'Match unavailable'; end if;
  if not exists (select 1 from public.session_players where session_id = p_session_id and player_id = auth.uid())
    or not exists (select 1 from public.vestiaire_rounds where session_id = p_session_id and motm_open) then
    raise exception 'Feedback is only available to joined players after the match';
  end if;
  if p_response is null or p_response not in ('happy','mixed','unhappy','skipped')
    or length(coalesce(p_comment,'')) > 500 then raise exception 'Invalid feedback'; end if;
  insert into public.team_feedback(session_id, player_id, response, comment)
    values(p_session_id, auth.uid(), p_response, case when p_response = 'skipped' then '' else trim(coalesce(p_comment,'')) end)
    on conflict(session_id, player_id) do update set response = excluded.response, comment = excluded.comment, updated_at = now();
  delete from public.match_notifications where session_id = p_session_id and recipient_id = auth.uid() and kind = 'team_feedback';
end;
$$;
revoke all on function public.save_team_feedback(uuid,text,text) from public, anon;
grant execute on function public.save_team_feedback(uuid,text,text) to authenticated;

create or replace function public.get_team_feedback_summary(p_session_id uuid)
returns table(happy bigint, mixed bigint, unhappy bigint, comments text[])
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_manage_match_teams(p_session_id) then raise exception 'Only team managers can see feedback'; end if;
  return query select count(*) filter(where f.response = 'happy'), count(*) filter(where f.response = 'mixed'),
    count(*) filter(where f.response = 'unhappy'),
    coalesce(array_agg(f.comment order by f.comment) filter(where f.comment <> '' and f.response <> 'skipped'), array[]::text[])
    from public.team_feedback f where f.session_id = p_session_id;
end;
$$;
revoke all on function public.get_team_feedback_summary(uuid) from public, anon;
grant execute on function public.get_team_feedback_summary(uuid) to authenticated;

create or replace function public.notify_team_feedback()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not old.motm_open and new.motm_open then
    insert into public.match_notifications(recipient_id, session_id, match_name, kind)
      select sp.player_id, s.id, s.name, 'team_feedback'
      from public.sessions s join public.session_players sp on sp.session_id = s.id
      where s.id = new.session_id and s.cancelled_at is null
        and not exists(select 1 from public.team_feedback f where f.session_id = s.id and f.player_id = sp.player_id)
      on conflict(recipient_id, session_id, kind) do nothing;
  end if;
  return new;
end;
$$;
create trigger notify_team_feedback after update of motm_open on public.vestiaire_rounds
  for each row execute function public.notify_team_feedback();
revoke all on function public.notify_team_feedback() from public, anon, authenticated;

create or replace function public.notify_post_match_join()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text; v_round public.vestiaire_rounds%rowtype;
begin
  select name into v_name from public.sessions where id = new.session_id and cancelled_at is null;
  select * into v_round from public.vestiaire_rounds where session_id = new.session_id;
  if v_name is not null and coalesce(v_round.motm_open, false) then
    if not v_round.motm_closed and not exists(select 1 from public.vestiaire_votes where session_id = new.session_id and voter_id = new.player_id and question_key = 'motm') then
      insert into public.match_notifications(recipient_id, session_id, match_name, kind)
        values(new.player_id, new.session_id, v_name, 'vestiaire_motm') on conflict(recipient_id, session_id, kind) do nothing;
    end if;
    if not exists(select 1 from public.team_feedback where session_id = new.session_id and player_id = new.player_id) then
      insert into public.match_notifications(recipient_id, session_id, match_name, kind)
        values(new.player_id, new.session_id, v_name, 'team_feedback') on conflict(recipient_id, session_id, kind) do nothing;
    end if;
  end if;
  return new;
end;
$$;
create trigger notify_post_match_join after insert on public.session_players
  for each row execute function public.notify_post_match_join();
revoke all on function public.notify_post_match_join() from public, anon, authenticated;

create or replace function public.clear_team_feedback_notice()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'session_players' then
    delete from public.match_notifications where session_id = old.session_id and recipient_id = old.player_id and kind = 'team_feedback';
    return old;
  end if;
  if old.cancelled_at is null and new.cancelled_at is not null then
    delete from public.match_notifications where session_id = new.id and kind = 'team_feedback';
  end if;
  return new;
end;
$$;
create trigger clear_team_feedback_on_leave after delete on public.session_players
  for each row execute function public.clear_team_feedback_notice();
create trigger clear_team_feedback_on_cancel after update of cancelled_at on public.sessions
  for each row execute function public.clear_team_feedback_notice();
revoke all on function public.clear_team_feedback_notice() from public, anon, authenticated;

-- Include existing matches whose post-match voting is already open or finished.
insert into public.match_notifications(recipient_id, session_id, match_name, kind)
select sp.player_id, s.id, s.name, 'team_feedback'
from public.sessions s join public.vestiaire_rounds r on r.session_id = s.id
join public.session_players sp on sp.session_id = s.id
where s.cancelled_at is null and r.motm_open
  and not exists(select 1 from public.team_feedback f where f.session_id = s.id and f.player_id = sp.player_id)
on conflict(recipient_id, session_id, kind) do nothing;

create or replace function public.get_vestiaire_results(p_session_id uuid)
returns table(question_key text, place integer, player_id uuid, display_name text)
language plpgsql security definer set search_path = public as $$
declare v_organizer boolean; v_joined boolean; v_predictions_ready boolean;
        v_motm_ready boolean; v_motm_open boolean;
begin
  select public.can_manage_match_teams(s.id), exists (
    select 1 from public.session_players sp
      where sp.session_id = s.id and sp.player_id = auth.uid()
  ) into v_organizer, v_joined
  from public.sessions s where s.id = p_session_id and s.cancelled_at is null;
  if auth.uid() is null or not coalesce(v_organizer, false) and not coalesce(v_joined, false) then
    raise exception 'Match unavailable';
  end if;

  select count(distinct v.question_key) = 6 into v_predictions_ready
    from public.vestiaire_votes v where v.session_id = p_session_id
      and v.voter_id = auth.uid() and v.question_key <> 'motm';
  select exists (
    select 1 from public.vestiaire_votes v where v.session_id = p_session_id
      and v.voter_id = auth.uid() and v.question_key = 'motm'
  ) into v_motm_ready;
  select coalesce(r.motm_open, false) into v_motm_open
    from public.vestiaire_rounds r where r.session_id = p_session_id;

  return query
    with totals as (
      select v.question_key, v.target_id, count(*) as vote_count
        from public.vestiaire_votes v where v.session_id = p_session_id
          and ((v.question_key <> 'motm' and (v_organizer or v_predictions_ready))
            or (v.question_key = 'motm' and coalesce(v_motm_open, false)
              and (v_organizer or v_motm_ready)))
        group by v.question_key, v.target_id
    ), ranked as (
      select t.question_key, t.target_id, p.display_name,
        row_number() over (partition by t.question_key
          order by t.vote_count desc, p.display_name, t.target_id)::integer as rank_no
        from totals t join public.profiles p on p.id = t.target_id
    )
    select r.question_key, r.rank_no, r.target_id, r.display_name
      from ranked r
      where r.rank_no <= case when r.question_key = 'motm' then 1 else 3 end
      order by r.question_key, r.rank_no;
end $$;

revoke all on function public.get_vestiaire_results(uuid) from public, anon;
grant execute on function public.get_vestiaire_results(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
