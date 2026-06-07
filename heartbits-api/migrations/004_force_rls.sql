-- HeartBits migration 004 — FORCE Row-Level Security
--
-- Defense-in-depth. RLS policies created in 001 only ENABLE RLS, which a table
-- OWNER (and any superuser) silently bypasses. The application now connects as
-- the non-owner role `heartbits_api`, which is already subject to RLS — but if a
-- connection is ever made as the table owner, ENABLE alone would leak every row.
-- FORCE makes the owner subject to its own policies too (superusers still bypass;
-- migrations run as the superuser so they continue to work).
--
-- Idempotent: FORCE is a flag — re-running is a no-op.

ALTER TABLE app.users    FORCE ROW LEVEL SECURITY;
ALTER TABLE app.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE app.media    FORCE ROW LEVEL SECURITY;
ALTER TABLE app.swipes   FORCE ROW LEVEL SECURITY;
ALTER TABLE app.matches  FORCE ROW LEVEL SECURITY;
ALTER TABLE app.bonds    FORCE ROW LEVEL SECURITY;
ALTER TABLE app.messages FORCE ROW LEVEL SECURITY;
ALTER TABLE app.consents FORCE ROW LEVEL SECURITY;
