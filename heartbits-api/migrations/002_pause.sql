-- 002_pause.sql — reversible account pause (deactivation)
--
-- Adds paused_at to app.users.
--   NULL      → active
--   non-NULL  → paused: hidden from discovery/matches, reactivated on next
--               login (POST /me/init clears paused_at). No data is destroyed.
--
-- Distinct from deleted_at (GDPR erasure): pause is reversible, delete is not.

ALTER TABLE app.users ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;
