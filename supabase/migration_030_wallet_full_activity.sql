-- Run after migration_029_wallet_player_names.sql.
-- Full history is fetched only when the player requests it.
begin;
create function public.get_club_wallet_activity()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_entries jsonb;
begin
  if v_user is null then raise exception 'Sign in to view your wallet'; end if;
  select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc, e.id desc), '[]'::jsonb)
  into v_entries from (
    select l.id, l.kind, l.amount, l.created_at, p.display_name as player_name
    from public.club_sats_ledger l
    left join public.profiles p on l.kind = 'rating' and l.source_key = 'rating:' || p.id::text
    where l.user_id = v_user
  ) e;
  return v_entries;
end;
$$;
revoke all on function public.get_club_wallet_activity() from public, anon;
grant execute on function public.get_club_wallet_activity() to authenticated;
notify pgrst, 'reload schema';
commit;
