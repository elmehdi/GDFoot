-- Migration 006: Add locked column to sessions for save & lock feature
-- When locked = true, teams cannot be reshuffled

alter table public.sessions add column if not exists locked boolean default false;
