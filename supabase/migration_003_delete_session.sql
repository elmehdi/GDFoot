-- Migration 003: Allow creator to delete sessions
-- Run this in Supabase SQL Editor.

create policy "Creator can delete session"
  on public.sessions for delete
  to authenticated
  using (auth.uid() = created_by);
