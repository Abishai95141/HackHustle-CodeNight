-- Add the new RSVP role to the existing app_role enum.
-- This MUST live in its own migration: Postgres forbids using a freshly-added
-- enum value within the same transaction it was added in. Subsequent
-- migrations (0003) reference 'rsvp' in policies and functions and will
-- fail with "unsafe use of new value of enum type" if combined here.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'rsvp';
