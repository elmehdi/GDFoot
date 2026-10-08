-- Run after migration_026_post_match_feedback.sql.
-- Published rankings are available to all joined players, even if they skipped voting.
-- Only aggregate names/ranks are returned; private ballots never leave the database.
begin;

create or replace function public.get_vestiaire_results(p_session_id uuid)
returns table(question_key text, place integer, player_id uuid, display_name text)
language plpgsql security definer set search_path = public as $$
declare v_organizer boolean; v_joined boolean; v_predictions_ready boolean;
        v_motm_ready boolean; v_motm_open boolean; v_finished boolean;
begin
  select public.can_manage_match_teams(s.id), exists (
    select 1 from public.session_players sp
      where sp.session_id = s.id and sp.player_id = auth.uid()
  ) into v_organizer, v_joined
  from public.sessions s where s.id = p_session_id and s.cancelled_at is null;
  if auth.uid() is null or not coalesce(v_organizer, false) and not coalesce(v_joined, false) then
    raise exception 'Match unavailable';
  end if;

  select count(distinct v.question_key) = 6 into v_predictions_ready
    from public.vestiaire_votes v where v.session_id = p_session_id
      and v.voter_id = auth.uid() and v.question_key <> 'motm';
  select exists (
    select 1 from public.vestiaire_votes v where v.session_id = p_session_id
      and v.voter_id = auth.uid() and v.question_key = 'motm'
  ) into v_motm_ready;
  select coalesce(r.motm_open, false), coalesce(r.motm_closed, false) into v_motm_open, v_finished
    from public.vestiaire_rounds r where r.session_id = p_session_id;

  return query
    with totals as (
      select v.question_key, v.target_id, count(*) as vote_count
        from public.vestiaire_votes v where v.session_id = p_session_id
          and ((v.question_key <> 'motm' and (v_organizer or v_predictions_ready or coalesce(v_finished, false)))
            or (v.question_key = 'motm' and coalesce(v_motm_open, false)
              and (v_organizer or v_motm_ready or coalesce(v_finished, false))))
        group by v.question_key, v.target_id
    ), ranked as (
      select t.question_key, t.target_id, p.display_name,
        row_number() over (partition by t.question_key
          order by t.vote_count desc, p.display_name, t.target_id)::integer as rank_no
        from totals t join public.profiles p on p.id = t.target_id
    )
    select r.question_key, r.rank_no, r.target_id, r.display_name
      from ranked r
      where r.rank_no <= case when r.question_key = 'motm' then 1 else 3 end
      order by r.question_key, r.rank_no;
end $$;

revoke all on function public.get_vestiaire_results(uuid) from public, anon;
grant execute on function public.get_vestiaire_results(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
