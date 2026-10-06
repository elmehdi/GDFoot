-- Optional card skills are separate from private team-balancing scores.
begin;
create table public.player_skill_ratings (
  voter_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  attack integer check (attack between 1 and 10),
  defense integer check (defense between 1 and 10),
  shooting integer check (shooting between 1 and 10),
  passing integer check (passing between 1 and 10),
  dribbling integer check (dribbling between 1 and 10),
  pace integer check (pace between 1 and 10),
  updated_at timestamptz not null default now(),
  primary key (voter_id, target_id),
  check (voter_id <> target_id)
);
create index player_skill_ratings_target_idx on public.player_skill_ratings(target_id);
alter table public.player_skill_ratings enable row level security;
create policy "Read own skill ratings" on public.player_skill_ratings for select to authenticated using (voter_id = auth.uid());
create policy "Insert own skill ratings" on public.player_skill_ratings for insert to authenticated with check (voter_id = auth.uid() and voter_id <> target_id);
create policy "Update own skill ratings" on public.player_skill_ratings for update to authenticated using (voter_id = auth.uid()) with check (voter_id = auth.uid() and voter_id <> target_id);
grant select, insert, update on public.player_skill_ratings to authenticated;

-- Save overall and optional skills together, so partial saves cannot occur.
create function public.save_player_card_rating(p_target_id uuid, p_score integer, p_skills jsonb)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null or auth.uid() = p_target_id then
    raise exception 'Cannot rate this player';
  end if;
  insert into public.player_ratings(voter_id, target_id, score, updated_at)
  values(auth.uid(), p_target_id, p_score, now())
  on conflict(voter_id, target_id) do update set score = excluded.score, updated_at = excluded.updated_at;
  insert into public.player_skill_ratings(voter_id, target_id, attack, defense, shooting, passing, dribbling, pace)
  values(auth.uid(), p_target_id, (p_skills->>'attack')::integer, (p_skills->>'defense')::integer,
    (p_skills->>'shooting')::integer, (p_skills->>'passing')::integer,
    (p_skills->>'dribbling')::integer, (p_skills->>'pace')::integer)
  on conflict(voter_id, target_id) do update set attack = excluded.attack, defense = excluded.defense,
    shooting = excluded.shooting, passing = excluded.passing, dribbling = excluded.dribbling,
    pace = excluded.pace, updated_at = now();
end;
$$;
revoke all on function public.save_player_card_rating(uuid, integer, jsonb) from public, anon;
grant execute on function public.save_player_card_rating(uuid, integer, jsonb) to authenticated;

create function public.save_match_card_votes(p_session_id uuid, p_votes jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare ballot jsonb;
begin
  if not exists (select 1 from public.sessions s where s.id = p_session_id and s.status = 'voting')
    or not exists (select 1 from public.session_players sp where sp.session_id = p_session_id and sp.player_id = auth.uid()) then
    raise exception 'Voting is not available';
  end if;
  for ballot in select value from jsonb_array_elements(p_votes) loop
    if not exists (select 1 from public.session_players sp where sp.session_id = p_session_id and sp.player_id = (ballot->>'target_id')::uuid) then
      raise exception 'Player is not in this match';
    end if;
    insert into public.votes(session_id, voter_id, target_id, score)
    values(p_session_id, auth.uid(), (ballot->>'target_id')::uuid, (ballot->>'score')::integer)
    on conflict(session_id, voter_id, target_id) do update set score = excluded.score;
    insert into public.player_skill_ratings(voter_id, target_id, attack, defense, shooting, passing, dribbling, pace)
    values(auth.uid(), (ballot->>'target_id')::uuid, (ballot->'skills'->>'attack')::integer,
      (ballot->'skills'->>'defense')::integer, (ballot->'skills'->>'shooting')::integer,
      (ballot->'skills'->>'passing')::integer, (ballot->'skills'->>'dribbling')::integer,
      (ballot->'skills'->>'pace')::integer)
    on conflict(voter_id, target_id) do update set attack = excluded.attack, defense = excluded.defense,
      shooting = excluded.shooting, passing = excluded.passing, dribbling = excluded.dribbling,
      pace = excluded.pace, updated_at = now();
  end loop;
end;
$$;
revoke all on function public.save_match_card_votes(uuid, jsonb) from public, anon;
grant execute on function public.save_match_card_votes(uuid, jsonb) to authenticated;

-- Return only playful skill labels, never ballots, numerical averages, or overall scores.
create function public.player_skill_label(skill text, value numeric)
returns text language sql immutable set search_path = public as $$
  select case
    when value is null then 'Not rated'
    when skill = 'attack' then case when value <= 2 then 'Parking it' when value <= 4 then 'A bit shy' when value <= 6 then 'Troublemaker' when value <= 8 then 'Nightmare' else 'Main character' end
    when skill = 'defense' then case when value <= 2 then 'Open door' when value <= 4 then 'Late tackle' when value <= 6 then 'Gets stuck in' when value <= 8 then 'Brick wall' else 'No way through' end
    when skill = 'shooting' then case when value <= 2 then 'Row Z' when value <= 4 then 'Post magnet' when value <= 6 then 'Clean strike' when value <= 8 then 'Top bins' else 'Ballon d’Or' end
    when skill = 'passing' then case when value <= 2 then 'GPS off' when value <= 4 then 'Hospital ball' when value <= 6 then 'Threading it' when value <= 8 then 'Laser vision' else 'Remote control' end
    when skill = 'dribbling' then case when value <= 2 then 'Heavy touch' when value <= 4 then 'One trick' when value <= 6 then 'Twinkle toes' when value <= 8 then 'Ankles gone' else 'Street legend' end
    when skill = 'pace' then case when value <= 2 then 'Sunday jog' when value <= 4 then 'Warming up' when value <= 6 then 'Quick feet' when value <= 8 then 'Turbo mode' else 'Gone' end
  end;
$$;
revoke all on function public.player_skill_label(text, numeric) from public, anon;
grant execute on function public.player_skill_label(text, numeric) to authenticated;
create function public.get_player_card_labels()
returns table(target_id uuid, attack text, defense text, shooting text, passing text, dribbling text, pace text)
language sql stable security definer set search_path = public as $$
  select r.target_id, public.player_skill_label('attack', avg(r.attack)), public.player_skill_label('defense', avg(r.defense)),
    public.player_skill_label('shooting', avg(r.shooting)), public.player_skill_label('passing', avg(r.passing)),
    public.player_skill_label('dribbling', avg(r.dribbling)), public.player_skill_label('pace', avg(r.pace))
  from public.player_skill_ratings r where auth.uid() is not null group by r.target_id;
$$;
revoke all on function public.get_player_card_labels() from public, anon;
grant execute on function public.get_player_card_labels() to authenticated;
notify pgrst, 'reload schema';
commit;
