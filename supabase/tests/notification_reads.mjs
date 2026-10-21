// Disposable in-memory PostgreSQL checks. See club_sats.mjs for FOOT_PGLITE_PATH setup.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const { PGlite } = await import(process.env.FOOT_PGLITE_PATH ? pathToFileURL(process.env.FOOT_PGLITE_PATH).href : '@electric-sql/pglite')
const db = new PGlite()
const alice = '00000000-0000-0000-0000-000000000001'
const bob = '00000000-0000-0000-0000-000000000002'
const ownNotice = '10000000-0000-0000-0000-000000000001'
const otherNotice = '10000000-0000-0000-0000-000000000002'
let checks = 0
const equal = (a,b,label) => { assert.deepEqual(a,b,label); checks++ }
const mark = keys => db.query('select public.mark_notifications_read($1::text[])', [keys])
try {
  await db.exec(`
    create role authenticated; create role anon; create schema auth;
    grant usage on schema public, auth to authenticated, anon;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table public.profiles(id uuid primary key);
    insert into public.profiles values('${alice}'),('${bob}');
    create table public.match_notifications(id uuid primary key,recipient_id uuid,created_at timestamptz default now());
    insert into public.match_notifications(id,recipient_id) values('${ownNotice}','${alice}'),('${otherNotice}','${bob}');
    create function public.get_pending_player_ratings() returns table(player_id uuid) language sql as $$
      select id from public.profiles where id <> auth.uid()
    $$;
  `)
  await db.exec(await readFile(new URL('../migration_031_notification_reads.sql',import.meta.url),'utf8'))
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[alice])
  await db.exec('set role authenticated')
  await mark(['notice:'+ownNotice])
  equal((await db.query('select count(*)::int as n from public.notification_reads')).rows[0].n,1,'individual read persisted')
  await mark(['notice:'+ownNotice,'notice:'+otherNotice,'rating:'+bob,'invalid'])
  equal((await db.query('select count(*)::int as n from public.notification_reads')).rows[0].n,2,'bulk read is idempotent and only accepts own eligible keys')
  await assert.rejects(db.exec('update public.notification_reads set read_at=now()'),/permission denied/); checks++
  await db.exec('reset role')
  equal((await db.query(`select n.created_at <= r.read_at as is_read from public.match_notifications n join public.notification_reads r on r.notification_key='notice:'||n.id::text where n.id='${ownNotice}'`)).rows[0].is_read,true,'read timestamp covers original notice')
  await db.exec(`update public.match_notifications set created_at=now()+interval '1 second' where id='${ownNotice}'`)
  equal((await db.query(`select n.created_at <= r.read_at as is_read from public.match_notifications n join public.notification_reads r on r.notification_key='notice:'||n.id::text where n.id='${ownNotice}'`)).rows[0].is_read,false,'republished notification becomes unread again')
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[bob])
  await db.exec('set role authenticated')
  equal((await db.query('select count(*)::int as n from public.notification_reads')).rows[0].n,0,'other account cannot read receipts')
  await mark(['notice:'+otherNotice])
  equal((await db.query('select count(*)::int as n from public.notification_reads')).rows[0].n,1,'other account manages its own receipts')
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claim.sub','',false)")
  await db.exec('set role authenticated')
  await assert.rejects(mark(['notice:'+ownNotice]),/Sign in/); checks++
  await db.exec('reset role; set role anon')
  await assert.rejects(mark([]),/permission denied/); checks++
  console.log(`PASS: ${checks} notification read checks`)
} finally { await db.close() }
