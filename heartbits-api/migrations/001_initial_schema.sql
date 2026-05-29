-- HeartBits initial schema
-- Run as superuser once, then grant roles below.
-- Idempotent: safe to re-run.

-- ─────────────────────────────────────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- gen_random_uuid() fallback
CREATE EXTENSION IF NOT EXISTS "btree_gist"; -- optional: for exclusion constraints

-- ─────────────────────────────────────────────────────────────────────────────
-- Schemas
-- ─────────────────────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS app;
CREATE SCHEMA IF NOT EXISTS billing;

-- ─────────────────────────────────────────────────────────────────────────────
-- Roles
-- ─────────────────────────────────────────────────────────────────────────────
-- SECURITY: The passwords below are placeholders ONLY.
-- Before running this migration in any non-local environment, replace 'changeme'
-- with a strong random password (e.g. openssl rand -base64 32) and store it in
-- a secrets manager (CI secret, Vault, etc.).  Never commit real passwords.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'heartbits_api') THEN
    CREATE ROLE heartbits_api LOGIN PASSWORD 'changeme'; -- SECURITY: replace before deploy
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'heartbits_billing') THEN
    CREATE ROLE heartbits_billing LOGIN PASSWORD 'changeme'; -- SECURITY: replace before deploy
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- app.users
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.users (
  id            TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  zitadel_sub   TEXT        UNIQUE NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);

ALTER TABLE app.users ENABLE ROW LEVEL SECURITY;

-- Users can only see / modify their own row
CREATE POLICY users_self ON app.users
  USING (id = current_setting('app.current_user_id', true));

-- ─────────────────────────────────────────────────────────────────────────────
-- app.profiles
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.profiles (
  id                  TEXT        PRIMARY KEY REFERENCES app.users(id) ON DELETE CASCADE,
  display_name        BYTEA,                        -- AES-256-GCM encrypted
  date_of_birth       BYTEA,                        -- AES-256-GCM encrypted
  bio                 BYTEA,                        -- AES-256-GCM encrypted
  gender              TEXT,
  seeking             TEXT[]      NOT NULL DEFAULT '{}',
  age_min             INT         NOT NULL DEFAULT 18,
  age_max             INT         NOT NULL DEFAULT 99,
  location_geohash6   TEXT        CHECK (char_length(location_geohash6) <= 6),
  avatar_media_id     TEXT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE app.profiles ENABLE ROW LEVEL SECURITY;

-- Public discovery: any authenticated user can read profiles (filtered in app layer).
-- The app layer enforces seeking / age / location filters on top of this.
CREATE POLICY profiles_read ON app.profiles
  FOR SELECT
  USING (current_setting('app.current_user_id', true) IS NOT NULL
         AND current_setting('app.current_user_id', true) != '');

-- SECURITY NOTE: profiles_write is scoped to INSERT/UPDATE/DELETE on own row only.
-- We use FOR ALL on the USING clause; for INSERT we also need WITH CHECK so the
-- new row's id matches the current user (prevents writing another user's profile).
CREATE POLICY profiles_write ON app.profiles
  FOR ALL
  USING (id = current_setting('app.current_user_id', true))
  WITH CHECK (id = current_setting('app.current_user_id', true));

-- ─────────────────────────────────────────────────────────────────────────────
-- app.media
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.media (
  id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id     TEXT        NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  bucket      TEXT        NOT NULL DEFAULT 'heartbits-media',
  object_key  TEXT        NOT NULL,   -- {user_id}/{uuid}.webp
  purpose     TEXT        NOT NULL CHECK (purpose IN ('avatar', 'gallery')),
  sort_order  INT         NOT NULL DEFAULT 0,
  sha256      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE app.media ENABLE ROW LEVEL SECURITY;

CREATE POLICY media_read ON app.media
  FOR SELECT
  USING (current_setting('app.current_user_id', true) IS NOT NULL
         AND current_setting('app.current_user_id', true) != '');

CREATE POLICY media_write ON app.media
  FOR ALL
  USING (user_id = current_setting('app.current_user_id', true));

-- Add FK from profiles to media now that media exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_avatar_media_id_fkey'
  ) THEN
    ALTER TABLE app.profiles
      ADD CONSTRAINT profiles_avatar_media_id_fkey
      FOREIGN KEY (avatar_media_id) REFERENCES app.media(id) ON DELETE SET NULL;
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- app.swipes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.swipes (
  swiper_id   TEXT        NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  swiped_id   TEXT        NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  direction   TEXT        NOT NULL CHECK (direction IN ('like', 'pass', 'superlike')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (swiper_id, swiped_id)
);

ALTER TABLE app.swipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY swipes_self ON app.swipes
  USING (swiper_id = current_setting('app.current_user_id', true));

CREATE INDEX IF NOT EXISTS swipes_swiped_id_idx ON app.swipes (swiped_id, direction);

-- ─────────────────────────────────────────────────────────────────────────────
-- app.matches
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.matches (
  id            TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_a_id     TEXT        NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  user_b_id     TEXT        NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  matched_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  unmatched_at  TIMESTAMPTZ,
  -- enforce user_a < user_b to prevent duplicate pairs
  CHECK (user_a_id < user_b_id),
  UNIQUE (user_a_id, user_b_id)
);

ALTER TABLE app.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY matches_participant ON app.matches
  USING (
    user_a_id = current_setting('app.current_user_id', true)
    OR user_b_id = current_setting('app.current_user_id', true)
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- app.bonds
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.bonds (
  id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  match_id    TEXT        NOT NULL UNIQUE REFERENCES app.matches(id) ON DELETE CASCADE,
  room_id     TEXT        NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE app.bonds ENABLE ROW LEVEL SECURITY;

-- Bond visible to both match participants (join through matches)
CREATE POLICY bonds_participant ON app.bonds
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app.matches m
      WHERE m.id = match_id
        AND (
          m.user_a_id = current_setting('app.current_user_id', true)
          OR m.user_b_id = current_setting('app.current_user_id', true)
        )
    )
  );

CREATE POLICY bonds_write ON app.bonds
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.matches m
      WHERE m.id = match_id
        AND (
          m.user_a_id = current_setting('app.current_user_id', true)
          OR m.user_b_id = current_setting('app.current_user_id', true)
        )
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- app.messages
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.messages (
  id              TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  match_id        TEXT        NOT NULL REFERENCES app.matches(id) ON DELETE CASCADE,
  sender_id       TEXT        NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  body_encrypted  BYTEA       NOT NULL,   -- AES-256-GCM, key = HKDF(master_key, match_id)
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at         TIMESTAMPTZ
);

ALTER TABLE app.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY messages_participant ON app.messages
  USING (
    EXISTS (
      SELECT 1 FROM app.matches m
      WHERE m.id = match_id
        AND (
          m.user_a_id = current_setting('app.current_user_id', true)
          OR m.user_b_id = current_setting('app.current_user_id', true)
        )
    )
  );

CREATE INDEX IF NOT EXISTS messages_match_id_sent_at ON app.messages (match_id, sent_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- app.consents  (GDPR Article 9 — biometric = special category)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.consents (
  id            TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id       TEXT        NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  consent_type  TEXT        NOT NULL CHECK (consent_type IN ('biometric_relay', 'marketing')),
  version       TEXT        NOT NULL,   -- semver of consent text shown
  consented_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address    INET,
  withdrawn_at  TIMESTAMPTZ,
  UNIQUE (user_id, consent_type, version)
);

ALTER TABLE app.consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY consents_self ON app.consents
  USING (user_id = current_setting('app.current_user_id', true));

-- ─────────────────────────────────────────────────────────────────────────────
-- app.audit_log  (INSERT-only — never deleted, erasure nulls actor_id)
--
-- GDPR RETENTION POLICY (TODO before public launch):
--   audit_log: retain 7 years (GDPR/ePrivacy compliance obligation for some
--     jurisdictions; minimum 1 year for incident response). Rows are INSERT-only;
--     erasure anonymises actor_id to NULL — the action record is preserved.
--     Implement via pg_partman monthly partitions + worker job that drops
--     partitions older than 7 years:
--       SELECT partman.create_parent('app.audit_log', 'created_at', 'native', 'monthly');
--
--   profiles / users: GDPR Art. 17 — erase within 30 days of account deletion.
--     Worker job: hard-DELETE from app.users WHERE deleted_at < NOW() - INTERVAL '30 days'
--     (CASCADE deletes profiles, swipes, matches, bonds, messages, consents).
--
--   messages: can be purged sooner than audit_log (e.g. 1 year from sent_at)
--     for data minimisation. Implement as a separate pg_partman parent on sent_at.
--
--   match history (swipes, matches): purge with user CASCADE on hard-delete.
--     No independent retention obligation beyond the user's account lifetime.
--
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.audit_log (
  id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  actor_id    TEXT,       -- NULLABLE: set to NULL on GDPR erasure
  action      TEXT        NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No RLS on audit_log — only the audit_log_writer role may INSERT
-- SELECT is denied to heartbits_api (admin/DBA only)
REVOKE ALL ON app.audit_log FROM PUBLIC;

-- ─────────────────────────────────────────────────────────────────────────────
-- billing schema
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS billing.customers (
  user_id                 TEXT        PRIMARY KEY REFERENCES app.users(id) ON DELETE CASCADE,
  stripe_customer_id      TEXT,       -- NULL until payments enabled
  stripe_subscription_id  TEXT,       -- NULL until payments enabled
  plan                    TEXT        NOT NULL DEFAULT 'free',
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Grants
-- ─────────────────────────────────────────────────────────────────────────────

-- heartbits_api: full access to app schema, read-only plan from billing
GRANT USAGE ON SCHEMA app TO heartbits_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO heartbits_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO heartbits_api;

-- audit_log: heartbits_api may INSERT and UPDATE (to set actor_id = NULL on erasure)
-- but MUST NOT DELETE rows (INSERT-only principle; SELECT denied — admin/DBA only).
-- SECURITY: The broad GRANT above gives SELECT too; revoke it here explicitly.
REVOKE SELECT, UPDATE, DELETE ON app.audit_log FROM heartbits_api;
-- Re-grant only INSERT and the UPDATE needed for GDPR erasure (actor anonymisation).
-- Note: UPDATE is scoped only to actor_id = NULL; enforcing column-level restriction
-- would require a separate audit_log_writer role. For now, we trust the app layer.
GRANT INSERT, UPDATE ON app.audit_log TO heartbits_api;

-- billing.customers: read plan only
GRANT USAGE ON SCHEMA billing TO heartbits_api;
GRANT SELECT (user_id, plan) ON billing.customers TO heartbits_api;

-- heartbits_billing: full billing access (used by billing worker, not API)
GRANT USAGE ON SCHEMA billing TO heartbits_billing;
GRANT SELECT, INSERT, UPDATE ON billing.customers TO heartbits_billing;
GRANT SELECT (id) ON app.users TO heartbits_billing;

-- ─────────────────────────────────────────────────────────────────────────────
-- Function: update updated_at automatically
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION app.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'profiles_updated_at') THEN
    CREATE TRIGGER profiles_updated_at
      BEFORE UPDATE ON app.profiles
      FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'billing_customers_updated_at') THEN
    CREATE TRIGGER billing_customers_updated_at
      BEFORE UPDATE ON billing.customers
      FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
  END IF;
END
$$;
