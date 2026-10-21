-- Run after migration_027_vestiaire_history.sql.
-- Club sats are fictional participation points, never transferable Bitcoin.
begin;

create table public.club_wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  light_mode_price bigint not null check (light_mode_price > 0),
  light_mode_unlocked_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.club_sats_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.club_wallets(user_id) on delete cascade,
  source_key text not null,
  kind text not null check (kind in ('rating', 'prediction', 'motm', 'light_mode')),
  amount bigint not null,
  created_at timestamptz not null default now(),
  unique(user_id, source_key),
  check ((kind = 'rating' and amount = 100)
    or (kind in ('prediction', 'motm') and amount = 25)
    or (kind = 'light_mode' and amount < 0))
);
create index club_sats_ledger_history_idx on public.club_sats_ledger(user_id, created_at desc);
alter table public.club_wallets enable row level security;
alter table public.club_sats_ledger enable row level security;
create policy "Read own club wallet" on public.club_wallets for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Read own club ledger" on public.club_sats_ledger for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.club_wallets, public.club_sats_ledger from public, anon, authenticated;
grant select on public.club_wallets, public.club_sats_ledger to authenticated;

-- Freeze each player's goal on wallet creation. New signups cannot raise it.
create function public.ensure_club_wallet(p_user_id uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.club_wallets(user_id, light_mode_price)
  select p_user_id, greatest(1, count(*)) * 100
  from public.profiles where id <> p_user_id
  on conflict (user_id) do nothing;
$$;
revoke all on function public.ensure_club_wallet(uuid) from public, anon, authenticated;

create function public.reward_club_participation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.voter_id = new.target_id then return new; end if;
  perform public.ensure_club_wallet(new.voter_id);
  if tg_table_name = 'player_ratings' then
    insert into public.club_sats_ledger(user_id, source_key, kind, amount)
    values (new.voter_id, 'rating:' || new.target_id::text, 'rating', 100)
    on conflict (user_id, source_key) do nothing;
  else
    insert into public.club_sats_ledger(user_id, source_key, kind, amount)
    values (new.voter_id, 'vote:' || new.session_id::text || ':' || new.question_key,
      case when new.question_key = 'motm' then 'motm' else 'prediction' end, 25)
    on conflict (user_id, source_key) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.reward_club_participation() from public, anon, authenticated;
create trigger reward_player_rating after insert or update on public.player_ratings
  for each row execute function public.reward_club_participation();
create trigger reward_vestiaire_vote after insert or update on public.vestiaire_votes
  for each row execute function public.reward_club_participation();

-- Credit historical participation once, without exposing private scores/ballots.
insert into public.club_wallets(user_id, light_mode_price)
select p.id, greatest(1, (select count(*) - 1 from public.profiles)) * 100
from public.profiles p on conflict (user_id) do nothing;
insert into public.club_sats_ledger(user_id, source_key, kind, amount, created_at)
select voter_id, 'rating:' || target_id::text, 'rating', 100, updated_at
from public.player_ratings where voter_id <> target_id
on conflict (user_id, source_key) do nothing;
insert into public.club_sats_ledger(user_id, source_key, kind, amount, created_at)
select voter_id, 'vote:' || session_id::text || ':' || question_key,
  case when question_key = 'motm' then 'motm' else 'prediction' end, 25, updated_at
from public.vestiaire_votes where voter_id <> target_id
on conflict (user_id, source_key) do nothing;

create function public.get_club_wallet()
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
      from (select id, kind, amount, created_at from public.club_sats_ledger
        where user_id = v_user order by created_at desc, id desc limit 12) e), '[]'::jsonb)
  ) into v_result from public.club_wallets w where w.user_id = v_user;
  return v_result;
end;
$$;

create function public.unlock_club_light_mode()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_wallet public.club_wallets%rowtype; v_balance bigint;
begin
  if v_user is null then raise exception 'Sign in to unlock light mode'; end if;
  perform public.ensure_club_wallet(v_user);
  -- Serialize purchases, including requests from different tabs/devices.
  select * into v_wallet from public.club_wallets where user_id = v_user for update;
  if v_wallet.light_mode_unlocked_at is not null then return public.get_club_wallet(); end if;
  select coalesce(sum(amount), 0) into v_balance from public.club_sats_ledger where user_id = v_user;
  if v_balance < v_wallet.light_mode_price then raise exception 'Not enough club sats'; end if;
  insert into public.club_sats_ledger(user_id, source_key, kind, amount)
  values (v_user, 'unlock:light_mode', 'light_mode', -v_wallet.light_mode_price);
  update public.club_wallets set light_mode_unlocked_at = now() where user_id = v_user;
  return public.get_club_wallet();
end;
$$;
revoke all on function public.get_club_wallet() from public, anon;
revoke all on function public.unlock_club_light_mode() from public, anon;
grant execute on function public.get_club_wallet(), public.unlock_club_light_mode() to authenticated;
notify pgrst, 'reload schema';
commit;
