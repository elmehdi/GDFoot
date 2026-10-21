-- Run after migration_031_notification_reads.sql and deploy the matching app.
-- Publishes the club sats launch notification to every existing player once.
begin;
create table if not exists public.club_announcements (
  user_id uuid not null references public.profiles(id) on delete cascade,
  announcement_key text not null,
  created_at timestamptz not null default now(),
  primary key(user_id, announcement_key)
);
alter table public.club_announcements enable row level security;
drop policy if exists "Read own club announcements" on public.club_announcements;
create policy "Read own club announcements" on public.club_announcements
  for select to authenticated using(user_id = (select auth.uid()));
revoke all on public.club_announcements from public, anon, authenticated;
grant select on public.club_announcements to authenticated;

insert into public.club_announcements(user_id, announcement_key)
select id, 'club_sats_launch' from public.profiles
on conflict(user_id, announcement_key) do nothing;

create or replace function public.mark_notifications_read(p_keys text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in to read notifications'; end if;
  insert into public.notification_reads(user_id, notification_key, read_at)
  select auth.uid(), eligible.key, now() from (
    select 'notice:' || id::text as key from public.match_notifications where recipient_id = auth.uid()
    union all
    select 'rating:' || player_id::text from public.get_pending_player_ratings()
    union all
    select 'announcement:' || announcement_key from public.club_announcements where user_id = auth.uid()
  ) eligible where eligible.key = any(p_keys)
  on conflict(user_id, notification_key) do update set read_at = excluded.read_at;
end;
$$;
revoke all on function public.mark_notifications_read(text[]) from public, anon;
grant execute on function public.mark_notifications_read(text[]) to authenticated;
notify pgrst, 'reload schema';
commit;
