-- Migration 004: Add vote progress function
-- Run this in Supabase SQL Editor.

-- Returns count of distinct voters in a session (no scores exposed)
create or replace function public.get_vote_progress(p_session_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select count(distinct voter_id)::integer
  from votes
  where session_id = p_session_id;
$$;
