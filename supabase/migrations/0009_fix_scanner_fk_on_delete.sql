-- ============================================================
-- 0009_fix_scanner_fk_on_delete
--   The original 0001_init.sql declared `scanned_by_staff_id` on
--   attendance_logs and meal_transactions as plain `REFERENCES profiles(id)`
--   with no ON DELETE clause — Postgres defaults that to NO ACTION, which
--   blocks deleting any volunteer/admin who has ever scanned someone. That
--   makes the admin "Purge users" / "Delete user" actions silently fail.
--
--   Switch both to ON DELETE SET NULL so the historical scan record stays
--   intact while the staff identity is forgotten on purge.
-- ============================================================

ALTER TABLE public.attendance_logs
  DROP CONSTRAINT attendance_logs_scanned_by_staff_id_fkey,
  ADD CONSTRAINT attendance_logs_scanned_by_staff_id_fkey
    FOREIGN KEY (scanned_by_staff_id)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;

ALTER TABLE public.meal_transactions
  DROP CONSTRAINT meal_transactions_scanned_by_staff_id_fkey,
  ADD CONSTRAINT meal_transactions_scanned_by_staff_id_fkey
    FOREIGN KEY (scanned_by_staff_id)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;
