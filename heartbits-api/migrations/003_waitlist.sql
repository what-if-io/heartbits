-- 003_waitlist.sql — pre-launch email waitlist
--
-- Public, pre-auth signups (no user context, so no RLS). Accessed by the API
-- owner role. email_norm (lowercased/trimmed) is unique for dedup.

CREATE TABLE IF NOT EXISTS app.waitlist (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email         TEXT NOT NULL,
  email_norm    TEXT NOT NULL UNIQUE,
  locale        TEXT,
  source        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at  TIMESTAMPTZ
);
