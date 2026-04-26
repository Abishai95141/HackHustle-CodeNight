-- Add 'query_team' to the app_role enum.
-- Lives in its own migration: Postgres forbids using a freshly-added enum
-- value within the same transaction it was added in. The follow-up migration
-- (0007) references 'query_team' inside RLS policy bodies and would fail with
-- "unsafe use of new value of enum type" if combined here.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'query_team';
