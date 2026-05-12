-- ============================================================
-- TEST SEED: Creates 9 fake players + you as 10th, a session, and votes
-- Run this in Supabase SQL Editor to test team generation.
-- DELETE this data after testing with the cleanup at the bottom.
-- ============================================================

-- 1. Create fake auth users and profiles
do $$
declare
  fake_players uuid[] := array[
    'aaaaaaaa-0001-4000-a000-000000000001'::uuid,
    'aaaaaaaa-0002-4000-a000-000000000002'::uuid,
    'aaaaaaaa-0003-4000-a000-000000000003'::uuid,
    'aaaaaaaa-0004-4000-a000-000000000004'::uuid,
    'aaaaaaaa-0005-4000-a000-000000000005'::uuid,
    'aaaaaaaa-0006-4000-a000-000000000006'::uuid,
    'aaaaaaaa-0007-4000-a000-000000000007'::uuid,
    'aaaaaaaa-0008-4000-a000-000000000008'::uuid,
    'aaaaaaaa-0009-4000-a000-000000000009'::uuid
  ];
  names text[] := array[
    'Amine', 'Reda', 'Karim', 'Mehdi',
    'Omar', 'Zakaria', 'Hamza', 'Ayoub', 'Ilyas'
  ];
  my_id uuid := '6634c708-e756-46f9-8a47-ae16946c9ded';
  all_players uuid[];
  test_session_id uuid := 'bbbbbbbb-0001-4000-b000-000000000001';
  i integer;
  j integer;
  v_voter_id uuid;
  v_target_id uuid;
  random_score integer;
  total_players integer := 10;
begin
  -- All players = 9 fake + you
  all_players := fake_players || array[my_id];

  -- Insert fake auth users (minimal, just so FK works)
  for i in 1..9 loop
    insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, instance_id, aud, role)
    values (
      fake_players[i],
      'test' || i || '@fake.local',
      '$2a$10$fakehashfakehashfakehashfakehashfakehashfakehashfake',
      now(),
      now(),
      now(),
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated'
    )
    on conflict (id) do nothing;
  end loop;

  -- Insert fake profiles
  for i in 1..9 loop
    insert into public.profiles (id, display_name)
    values (fake_players[i], names[i])
    on conflict (id) do nothing;
  end loop;

  -- Create a test session (5v5, owned by YOU)
  insert into public.sessions (id, name, created_by, status, team_size)
  values (test_session_id, '⚡ Test Match - 5v5', my_id, 'voting', 5)
  on conflict (id) do nothing;

  -- Add all 10 players to the session (9 fake + you)
  for i in 1..total_players loop
    insert into public.session_players (session_id, player_id)
    values (test_session_id, all_players[i])
    on conflict (session_id, player_id) do nothing;
  end loop;

  -- Simulate votes FROM the 9 fake players (they vote on everyone including you)
  for i in 1..9 loop
    for j in 1..total_players loop
      if fake_players[i] != all_players[j] then
        v_voter_id := fake_players[i];
        v_target_id := all_players[j];
        random_score := greatest(1, least(10,
          case
            when j <= 3 then 7 + floor(random() * 3)::int   -- top: 7-9
            when j <= 7 then 5 + floor(random() * 3)::int   -- mid: 5-7
            else 3 + floor(random() * 4)::int               -- lower: 3-6
          end
          + (floor(random() * 3) - 1)::int
        ));
        insert into public.votes (session_id, voter_id, target_id, score)
        values (test_session_id, v_voter_id, v_target_id, random_score)
        on conflict (session_id, voter_id, target_id) do nothing;
      end if;
    end loop;
  end loop;

  -- NOTE: YOU still need to vote on the 9 fake players via the app!
  raise notice 'Test data created! You are the session owner. Go vote on 9 players, then generate teams.';
end;
$$;


-- ============================================================
-- TO GENERATE TEAMS (after you vote), run this:
-- select * from generate_teams('bbbbbbbb-0001-4000-b000-000000000001');
-- ============================================================


-- ============================================================
-- CLEANUP: Run this AFTER you're done testing
-- ============================================================
-- delete from public.sessions where id = 'bbbbbbbb-0001-4000-b000-000000000001';
-- delete from public.profiles where id::text like 'aaaaaaaa-%';
-- delete from auth.users where id::text like 'aaaaaaaa-%';
