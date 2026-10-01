-- Run after migration_016_reopen_team_setup.sql.
begin;

alter table public.match_notifications
  add column if not exists kind text not null default 'cancelled';
alter table public.match_notifications
  drop constraint if exists match_notifications_recipient_id_session_id_key;
create unique index if not exists match_notifications_recipient_session_kind_idx
  on public.match_notifications(recipient_id, session_id, kind);
do $$ begin
  if not exists (select 1 from pg_constraint
    where conname = 'match_notifications_kind_check'
      and conrelid = 'public.match_notifications'::regclass) then
    alter table public.match_notifications
      add constraint match_notifications_kind_check
      check (kind in ('cancelled', 'ready'));
  end if;
end $$;

-- The session is already locked by the team generator or reopen RPC.
-- A proposal sends one notice per joined player. Reopening removes that
-- proposal notice so the inbox never links to a lineup that was cleared.
create or replace function public.notify_match_state()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'completed' and new.status = 'open' then
    delete from public.match_notifications
      where session_id = new.id and kind = 'ready';
  end if;

  if old.status is distinct from 'completed' and new.status = 'completed'
     and new.cancelled_at is null then
    insert into public.match_notifications(recipient_id, session_id, match_name, kind)
      select sp.player_id, new.id, new.name, 'ready'
      from public.session_players sp where sp.session_id = new.id
      on conflict (recipient_id, session_id, kind)
      do update set match_name = excluded.match_name, created_at = now();
  end if;

  if old.cancelled_at is null and new.cancelled_at is not null then
    delete from public.match_notifications
      where session_id = new.id and kind = 'ready';
  end if;
  return new;
end $$;

drop trigger if exists notify_match_state on public.sessions;
create trigger notify_match_state after update of status, cancelled_at
  on public.sessions for each row execute function public.notify_match_state();
revoke all on function public.notify_match_state() from public, anon, authenticated;

-- Notify players whose lineups were generated before this migration.
insert into public.match_notifications(recipient_id, session_id, match_name, kind)
select sp.player_id, s.id, s.name, 'ready'
from public.sessions s
join public.session_players sp on sp.session_id = s.id
where s.status = 'completed' and s.cancelled_at is null
on conflict (recipient_id, session_id, kind) do nothing;

notify pgrst, 'reload schema';
commit;
