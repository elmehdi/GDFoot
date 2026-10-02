-- Run after migration_020_live_vestiaire_results.sql.
-- In-app reminders for joined players; ballots remain private.
begin;

alter table public.match_notifications drop constraint if exists match_notifications_kind_check;
alter table public.match_notifications add constraint match_notifications_kind_check
  check (kind in ('cancelled', 'ready', 'vestiaire_predictions', 'vestiaire_motm'));

create or replace function public.notify_vestiaire_join()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  select s.name into v_name from public.sessions s where s.id = new.session_id
    and s.cancelled_at is null and not exists (
      select 1 from public.vestiaire_rounds r where r.session_id = s.id and r.predictions_closed
    );
  if v_name is not null then
    insert into public.match_notifications(recipient_id, session_id, match_name, kind)
      values (new.player_id, new.session_id, v_name, 'vestiaire_predictions')
      on conflict (recipient_id, session_id, kind) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists notify_vestiaire_join on public.session_players;
create trigger notify_vestiaire_join after insert on public.session_players
  for each row execute function public.notify_vestiaire_join();

create or replace function public.clear_vestiaire_vote_reminder()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.question_key = 'motm' then
    delete from public.match_notifications where recipient_id = new.voter_id
      and session_id = new.session_id and kind = 'vestiaire_motm';
  elsif (select count(distinct v.question_key) from public.vestiaire_votes v
      where v.session_id = new.session_id and v.voter_id = new.voter_id
        and v.question_key <> 'motm') = 6 then
    delete from public.match_notifications where recipient_id = new.voter_id
      and session_id = new.session_id and kind = 'vestiaire_predictions';
  end if;
  return new;
end $$;
drop trigger if exists clear_vestiaire_vote_reminder on public.vestiaire_votes;
create trigger clear_vestiaire_vote_reminder after insert or update on public.vestiaire_votes
  for each row execute function public.clear_vestiaire_vote_reminder();

create or replace function public.notify_vestiaire_phase()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  if not old.predictions_closed and new.predictions_closed then
    delete from public.match_notifications where session_id = new.session_id
      and kind = 'vestiaire_predictions';
  end if;
  if not old.motm_open and new.motm_open then
    select s.name into v_name from public.sessions s where s.id = new.session_id
      and s.cancelled_at is null;
    if v_name is not null then
      insert into public.match_notifications(recipient_id, session_id, match_name, kind)
        select sp.player_id, new.session_id, v_name, 'vestiaire_motm'
        from public.session_players sp where sp.session_id = new.session_id
          and not exists (
            select 1 from public.vestiaire_votes v where v.session_id = new.session_id
              and v.voter_id = sp.player_id and v.question_key = 'motm'
          )
        on conflict (recipient_id, session_id, kind) do nothing;
    end if;
  end if;
  if not old.motm_closed and new.motm_closed then
    delete from public.match_notifications where session_id = new.session_id
      and kind = 'vestiaire_motm';
  end if;
  return new;
end $$;
drop trigger if exists notify_vestiaire_phase on public.vestiaire_rounds;
create trigger notify_vestiaire_phase after update on public.vestiaire_rounds
  for each row execute function public.notify_vestiaire_phase();

create or replace function public.clear_vestiaire_match_reminders()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'session_players' then
    delete from public.match_notifications where recipient_id = old.player_id
      and session_id = old.session_id and kind in ('vestiaire_predictions', 'vestiaire_motm');
    return old;
  elsif old.cancelled_at is null and new.cancelled_at is not null then
    delete from public.match_notifications where session_id = new.id
      and kind in ('vestiaire_predictions', 'vestiaire_motm');
  end if;
  return new;
end $$;
drop trigger if exists clear_vestiaire_roster_reminders on public.session_players;
create trigger clear_vestiaire_roster_reminders after delete on public.session_players
  for each row execute function public.clear_vestiaire_match_reminders();
drop trigger if exists clear_vestiaire_cancelled_reminders on public.sessions;
create trigger clear_vestiaire_cancelled_reminders after update of cancelled_at on public.sessions
  for each row execute function public.clear_vestiaire_match_reminders();

-- Existing active matches also invite their joined players.
insert into public.match_notifications(recipient_id, session_id, match_name, kind)
select sp.player_id, s.id, s.name, 'vestiaire_predictions'
from public.sessions s join public.session_players sp on sp.session_id = s.id
where s.cancelled_at is null
  and not exists (select 1 from public.vestiaire_rounds r
    where r.session_id = s.id and r.predictions_closed)
  and (select count(distinct v.question_key) from public.vestiaire_votes v
    where v.session_id = s.id and v.voter_id = sp.player_id and v.question_key <> 'motm') < 6
on conflict (recipient_id, session_id, kind) do nothing;

insert into public.match_notifications(recipient_id, session_id, match_name, kind)
select sp.player_id, s.id, s.name, 'vestiaire_motm'
from public.sessions s join public.vestiaire_rounds r on r.session_id = s.id
join public.session_players sp on sp.session_id = s.id
where s.cancelled_at is null and r.motm_open and not r.motm_closed
  and not exists (select 1 from public.vestiaire_votes v
    where v.session_id = s.id and v.voter_id = sp.player_id and v.question_key = 'motm')
on conflict (recipient_id, session_id, kind) do nothing;

revoke all on function public.notify_vestiaire_join(), public.clear_vestiaire_vote_reminder(),
  public.notify_vestiaire_phase(), public.clear_vestiaire_match_reminders()
  from public, anon, authenticated;
notify pgrst, 'reload schema';
commit;
