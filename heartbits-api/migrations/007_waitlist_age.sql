-- HeartBits migration 007 — record 18+ attestation on the waitlist
-- The signup form requires an 18+ checkbox; persist the attestation server-side
-- (the API also rejects signups without it). Idempotent.
ALTER TABLE app.waitlist
  ADD COLUMN IF NOT EXISTS age_confirmed boolean NOT NULL DEFAULT false;
