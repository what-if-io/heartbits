-- HeartBits migration 006 — allow authenticated users to read user rows
--
-- The original users_self policy restricts ALL commands (incl. SELECT) to the
-- user's own row. But authenticated flows must reference OTHER users' rows:
-- swipe needs to confirm the target exists/active, discover joins users for
-- deleted_at/paused_at, match/bond flows reference participants. Under the
-- (now-enforced) heartbits_api role this made login-adjacent flows fail.
--
-- Mirror profiles_read: any authenticated user may SELECT app.users; writes
-- (UPDATE/DELETE) remain self-only via users_self. The users table holds no
-- profile PII (that lives in app.profiles, field-encrypted) — only the
-- zitadel_sub link and lifecycle timestamps.
--
-- Idempotent.

DROP POLICY IF EXISTS users_read ON app.users;
CREATE POLICY users_read ON app.users
  FOR SELECT
  USING (current_setting('app.current_user_id', true) IS NOT NULL
         AND current_setting('app.current_user_id', true) != '');

-- Mutual-like detection: a user must be able to read swipes TARGETING them
-- (swiped_id = me), in addition to their own (swipes_self covers swiper_id = me).
-- Server-side only — the app reveals inbound likes solely on a confirmed match.
DROP POLICY IF EXISTS swipes_inbound ON app.swipes;
CREATE POLICY swipes_inbound ON app.swipes
  FOR SELECT
  USING (swiped_id = current_setting('app.current_user_id', true));
