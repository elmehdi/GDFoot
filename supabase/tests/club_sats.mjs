// Run only against an in-memory PostgreSQL instance, never a real Supabase project.
// Install @electric-sql/pglite in a temporary folder and provide its index.js path
// via FOOT_PGLITE_PATH, or install it locally without saving it as a dependency.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const { PGlite } = await import(process.env.FOOT_PGLITE_PATH
  ? pathToFileURL(process.env.FOOT_PGLITE_PATH).href : '@electric-sql/pglite')
const db = new PGlite()
const alice = '00000000-0000-0000-0000-000000000001'
const bob = '00000000-0000-0000-0000-000000000002'
const cara = '00000000-0000-0000-0000-000000000003'
const match = '10000000-0000-0000-0000-000000000001'
let checks = 0
const equal = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++ }
const wallet = async () => (await db.query('select public.get_club_wallet() as wallet')).rows[0].wallet
const denied = async (sql, pattern = /permission denied/) => {
  await assert.rejects(db.exec(sql), pattern); checks++
}
const asUser = async id => {
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? ''])
  await db.exec('set role authenticated')
}
try {
  // Minimal versions of the pre-existing tables/auth interface used by migration 028.
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema public, auth to authenticated, anon;
    create table public.profiles(id uuid primary key);
    insert into public.profiles values ('${alice}'), ('${bob}'), ('${cara}');
    create table public.player_ratings(
      voter_id uuid references public.profiles, target_id uuid references public.profiles,
      score int not null check(score between 1 and 10), updated_at timestamptz not null default now(),
      primary key(voter_id, target_id));
    create table public.vestiaire_votes(
      session_id uuid, question_key text, voter_id uuid references public.profiles,
      target_id uuid references public.profiles, updated_at timestamptz not null default now(),
      primary key(session_id, question_key, voter_id));
    insert into public.player_ratings values('${alice}', '${bob}', 7, now());
    insert into public.vestiaire_votes values('${match}', 'late', '${alice}', '${bob}', now());
  `)
  await db.exec(await readFile(new URL('../migration_028_club_sats.sql', import.meta.url), 'utf8'))
  await db.exec(`alter table public.profiles add column display_name text;
    update public.profiles set display_name = 'Badr' where id = '${bob}';`)
  await db.exec(await readFile(new URL('../migration_029_wallet_player_names.sql', import.meta.url), 'utf8'))
  await db.exec(await readFile(new URL('../migration_030_wallet_full_activity.sql', import.meta.url), 'utf8'))
  await asUser(alice)
  let result = await wallet()
  equal(result.balance, 125, 'historical ratings and votes credited')
  equal(result.light_mode_price, 200, 'two other players set the price')
  equal(result.light_mode_unlocked, false, 'light mode initially locked')
  equal(result.entries.length, 2, 'historical entries returned')
  equal(result.entries.find(e => e.kind === 'rating').player_name, 'Badr', 'historical rating includes player name')
  equal(result.entries.find(e => e.kind === 'prediction').player_name, null, 'vote targets remain private')
  equal('score' in result.entries.find(e => e.kind === 'rating'), false, 'rating score is not exposed')
  await denied("insert into public.club_sats_ledger(user_id,source_key,kind,amount) values('" + alice + "','cheat','rating',100)")
  await denied('update public.club_wallets set light_mode_unlocked_at = now()')
  await denied(`select public.ensure_club_wallet('${bob}')`)
  await denied('select public.reward_club_participation()')
  equal((await db.query('select distinct user_id from public.club_wallets')).rows, [{ user_id: alice }], 'wallet RLS hides others')
  equal((await db.query('select distinct user_id from public.club_sats_ledger')).rows, [{ user_id: alice }], 'ledger RLS hides others')
  await denied('select public.unlock_club_light_mode()', /Not enough club sats/)
  equal((await wallet()).balance, 125, 'insufficient purchase does not debit')
  await db.exec('reset role')
  await db.exec(`
    update public.player_ratings set score=9 where voter_id='${alice}';
    delete from public.player_ratings where voter_id='${alice}';
    insert into public.player_ratings values('${alice}', '${bob}', 5, now());
    update public.vestiaire_votes set target_id='${cara}' where voter_id='${alice}';
    delete from public.vestiaire_votes where voter_id='${alice}';
    insert into public.vestiaire_votes values('${match}', 'late', '${alice}', '${bob}', now());
  `)
  await asUser(alice)
  equal((await wallet()).balance, 125, 'edits and delete/reinsert cannot farm rewards')
  await db.exec('reset role')
  await db.exec(`
    insert into public.vestiaire_votes values('${match}', 'motm', '${alice}', '${bob}', now());
    insert into public.vestiaire_votes values('${match}', 'first_foul', '${alice}', '${bob}', now());
    insert into public.player_ratings values('${alice}', '${cara}', 8, now());
  `)
  await asUser(alice)
  result = await wallet()
  equal(result.balance, 275, 'new player, prediction, and MOTM earn rewards')
  equal(result.entries.some(e => e.kind === 'motm' && e.amount === 25), true, 'MOTM classified correctly')
  // Queued duplicate requests use the exact same purchase RPC as multiple clicks.
  await Promise.all([db.query('select public.unlock_club_light_mode()'), db.query('select public.unlock_club_light_mode()')])
  result = await wallet()
  equal(result.balance, 75, 'purchase charges the frozen price once')
  equal(result.light_mode_unlocked, true, 'permanent entitlement saved')
  equal(result.entries.filter(e => e.kind === 'light_mode').length, 1, 'one debit for repeated purchase')
  equal(result.earned, 275, 'lifetime earnings survive spending')
  await asUser(bob)
  equal((await wallet()).balance, 0, 'another account has its own balance')
  equal((await wallet()).light_mode_unlocked, false, 'another account does not inherit entitlement')
  await db.exec('reset role')
  await db.exec(`insert into public.profiles values('00000000-0000-0000-0000-000000000004')`)
  await asUser(alice)
  equal((await wallet()).light_mode_price, 200, 'new player does not raise the goal')
  await asUser('00000000-0000-0000-0000-000000000004')
  equal((await wallet()).light_mode_price, 300, 'new account gets current squad price')
  await db.exec('reset role')
  await db.exec(`insert into public.vestiaire_votes(session_id,question_key,voter_id,target_id)
    select ('20000000-0000-0000-0000-' || lpad(i::text,12,'0'))::uuid, 'late', '${alice}', '${bob}'
    from generate_series(1,20) i`)
  await asUser(alice)
  const recent = (await wallet()).entries
  const full = (await db.query('select public.get_club_wallet_activity() as entries')).rows[0].entries
  equal(recent.length, 12, 'wallet summary still returns only 12 entries')
  equal(full.length, 26, 'full activity includes all rewards and purchase')
  equal(full.slice(0,12), recent, 'full activity uses the same stable newest-first ordering')
  equal(full.some(e => e.player_name === 'Badr'), true, 'full activity retains historical player names')
  await asUser(bob)
  equal((await db.query('select public.get_club_wallet_activity() as entries')).rows[0].entries, [], 'full activity hides other accounts')
  await asUser(null)
  await denied('select public.get_club_wallet_activity()', /Sign in/)
  await denied('select public.get_club_wallet()', /Sign in/)
  await denied('select public.unlock_club_light_mode()', /Sign in/)
  await db.exec('reset role; set role anon')
  await denied('select public.get_club_wallet_activity()')
  await denied('select public.get_club_wallet()')
  await denied('select public.unlock_club_light_mode()')
  console.log(`PASS: ${checks} club sats database checks`)
} finally { await db.close() }
