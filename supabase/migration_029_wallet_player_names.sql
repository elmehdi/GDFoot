-- Run after migration_028_club_sats.sql. No balances or rewards are changed.
begin;
create or replace function public.get_club_wallet()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_result jsonb;
begin
  if v_user is null then raise exception 'Sign in to view your wallet'; end if;
  perform public.ensure_club_wallet(v_user);
  select jsonb_build_object(
    'balance', coalesce((select sum(amount) from public.club_sats_ledger where user_id = v_user), 0),
    'earned', coalesce((select sum(amount) from public.club_sats_ledger where user_id = v_user and amount > 0), 0),
    'light_mode_price', w.light_mode_price,
    'light_mode_unlocked', w.light_mode_unlocked_at is not null,
    'rating_reward', 100, 'vote_reward', 25,
    'entries', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc, e.id desc)
      from (
        select l.id, l.kind, l.amount, l.created_at, p.display_name as player_name
        from (select id, kind, amount, created_at, source_key from public.club_sats_ledger
          where user_id = v_user order by created_at desc, id desc limit 12) l
        left join public.profiles p on l.kind = 'rating' and l.source_key = 'rating:' || p.id::text
      ) e), '[]'::jsonb)
  ) into v_result from public.club_wallets w where w.user_id = v_user;
  return v_result;
end;
$$;
revoke all on function public.get_club_wallet() from public, anon;
grant execute on function public.get_club_wallet() to authenticated;
notify pgrst, 'reload schema';
commit;
