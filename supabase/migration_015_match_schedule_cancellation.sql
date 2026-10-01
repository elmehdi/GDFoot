-- Run after migration_014_full_teams.sql.
begin;
alter table public.sessions add column if not exists scheduled_at timestamptz;
alter table public.sessions add column if not exists cancelled_at timestamptz;
create table if not exists public.match_notifications (
 id uuid primary key default gen_random_uuid(), recipient_id uuid not null references public.profiles(id) on delete cascade,
 session_id uuid not null, match_name text not null, created_at timestamptz not null default now(),
 unique(recipient_id,session_id)
);
alter table public.match_notifications enable row level security;
drop policy if exists "Read own cancellations" on public.match_notifications;
create policy "Read own cancellations" on public.match_notifications for select to authenticated using(recipient_id=auth.uid());
revoke all on public.match_notifications from anon,authenticated;
grant select on public.match_notifications to authenticated;
create or replace function public.guard_cancelled_match() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='UPDATE' and old.cancelled_at is not null then raise exception 'Match cancelled'; end if;
 if new.cancelled_at is not null then
  if auth.uid() is null or auth.uid() <> new.created_by then raise exception 'Only the organizer can cancel'; end if;
  insert into public.match_notifications(recipient_id,session_id,match_name)
   select player_id,new.id,new.name from public.session_players where session_id=new.id
   on conflict do nothing;
 end if;
 return new;
end $$;
drop trigger if exists guard_cancelled_match on public.sessions;
create trigger guard_cancelled_match before update on public.sessions for each row execute function public.guard_cancelled_match();
create or replace function public.cancel_match(p_session_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare s public.sessions%rowtype;
begin
 select * into s from public.sessions where id=p_session_id for update;
 if not found or auth.uid() is null or s.created_by<>auth.uid() then raise exception 'Only the organizer can cancel'; end if;
 if s.cancelled_at is not null then return; end if;
 update public.sessions set cancelled_at=now(),locked=true where id=p_session_id;
end $$;
create or replace function public.guard_cancelled_roster() returns trigger language plpgsql security definer set search_path=public as $$
begin
 perform 1 from public.sessions where id=new.session_id and cancelled_at is null for update;
 if not found then raise exception 'Match cancelled'; end if;
 return new;
end $$;
drop trigger if exists guard_cancelled_roster on public.session_players;
create trigger guard_cancelled_roster before insert or update on public.session_players for each row execute function public.guard_cancelled_roster();
revoke all on function public.guard_cancelled_match(),public.guard_cancelled_roster(),public.cancel_match(uuid) from public,anon,authenticated;
grant execute on function public.cancel_match(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
