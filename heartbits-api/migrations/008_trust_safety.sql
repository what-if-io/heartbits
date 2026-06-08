-- HeartBits migration 008 — Trust & Safety: blocks + reports
-- Launch-critical for a dating product. Idempotent.

-- ── Blocks ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.blocks (
  id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  blocker_id  TEXT        NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  blocked_id  TEXT        NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE INDEX IF NOT EXISTS blocks_blocked_idx ON app.blocks (blocked_id);

ALTER TABLE app.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.blocks FORCE ROW LEVEL SECURITY;

-- Read blocks involving me in EITHER direction (needed to enforce mutual
-- invisibility in discover/swipe). Writes are own-blocks only.
DROP POLICY IF EXISTS blocks_involved ON app.blocks;
CREATE POLICY blocks_involved ON app.blocks
  FOR SELECT
  USING (blocker_id = current_setting('app.current_user_id', true)
      OR blocked_id = current_setting('app.current_user_id', true));

DROP POLICY IF EXISTS blocks_write ON app.blocks;
CREATE POLICY blocks_write ON app.blocks
  FOR ALL
  USING (blocker_id = current_setting('app.current_user_id', true))
  WITH CHECK (blocker_id = current_setting('app.current_user_id', true));

-- ── Reports ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.reports (
  id           TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  reporter_id  TEXT        NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  reported_id  TEXT        NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  reason       TEXT        NOT NULL,
  details      TEXT,
  status       TEXT        NOT NULL DEFAULT 'open'
               CHECK (status IN ('open', 'reviewed', 'actioned', 'dismissed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (reporter_id <> reported_id)
);
CREATE INDEX IF NOT EXISTS reports_status_idx ON app.reports (status, created_at);

ALTER TABLE app.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.reports FORCE ROW LEVEL SECURITY;

-- A user may file + see their OWN reports. Moderation reads/updates run via the
-- BYPASSRLS worker role (no end-user can read others' reports).
DROP POLICY IF EXISTS reports_self ON app.reports;
CREATE POLICY reports_self ON app.reports
  FOR ALL
  USING (reporter_id = current_setting('app.current_user_id', true))
  WITH CHECK (reporter_id = current_setting('app.current_user_id', true));

-- heartbits_api gets table grants via ALTER DEFAULT PRIVILEGES (migration 001).
-- Moderation surface for the worker role:
GRANT SELECT, UPDATE ON app.reports TO heartbits_worker;
GRANT SELECT, DELETE ON app.blocks  TO heartbits_worker;
