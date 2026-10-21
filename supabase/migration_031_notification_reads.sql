-- Run after migration_030_wallet_full_activity.sql.
begin;
create table public.notification_reads (
  user_id uuid not null references public.profiles(id) on delete cascade,
  notification_key text not null,
  read_at timestamptz not null default now(),
  primary key(user_id, notification_key)
);
alter table public.notification_reads enable row level security;
create policy "Read own notification receipts" on public.notification_reads
  for select to authenticated using(user_id = (select auth.uid()));
revoke all on public.notification_reads from public, anon, authenticated;
grant select on public.notification_reads to authenticated;

create function public.mark_notifications_read(p_keys text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in to read notifications'; end if;
  insert into public.notification_reads(user_id, notification_key, read_at)
  select auth.uid(), eligible.key, now() from (
    select 'notice:' || id::text as key from public.match_notifications where recipient_id = auth.uid()
    union all
    select 'rating:' || player_id::text from public.get_pending_player_ratings()
  ) eligible where eligible.key = any(p_keys)
  on conflict(user_id, notification_key) do update set read_at = excluded.read_at;
end;
$$;
revoke all on function public.mark_notifications_read(text[]) from public, anon;
grant execute on function public.mark_notifications_read(text[]) to authenticated;
notify pgrst, 'reload schema';
commit;
