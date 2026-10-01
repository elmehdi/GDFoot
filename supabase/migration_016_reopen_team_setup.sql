-- Run after migration_015_match_schedule_cancellation.sql.
begin;
create or replace function public.reopen_match_for_edits(p_session_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare s public.sessions%rowtype;
begin
 select * into s from public.sessions where id=p_session_id for update;
 if not found or auth.uid() is null or s.created_by<>auth.uid() then raise exception 'Only the organizer can return to match setup'; end if;
 if s.cancelled_at is not null then raise exception 'Cancelled match cannot be reopened'; end if;
 if s.locked then raise exception 'Confirmed teams cannot be changed'; end if;
 if s.status<>'completed' then raise exception 'Teams have not been generated yet'; end if;
 if s.league_id is not null and s.home_squad is not null then raise exception 'Fixed league squads cannot be edited'; end if;
 update public.session_players set team=null where session_id=p_session_id;
 update public.sessions set status='open' where id=p_session_id;
end $$;
revoke all on function public.reopen_match_for_edits(uuid) from public,anon;
grant execute on function public.reopen_match_for_edits(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
