-- HeartBits migration 005 — auth/registration bootstrap helpers
--
-- The API connects as the non-owner `heartbits_api` role, so RLS applies. But
-- login (resolve sub → user id) and registration (create the user row) happen
-- BEFORE any user context exists — and the users/profiles RLS policies are keyed
-- on `app.current_user_id`, which isn't set yet. So these two narrow operations
-- must bypass RLS. We expose them as SECURITY DEFINER functions (run as the
-- owner, which bypasses RLS), each doing the minimum and nothing else.
--
-- Idempotent: CREATE OR REPLACE + re-grant.

-- Resolve a Zitadel sub → { id, deleted }. Used by the auth plugin and by
-- /me/init's "is this account deleted / is it new?" checks.
CREATE OR REPLACE FUNCTION app.user_lookup(p_sub text)
RETURNS TABLE (id text, deleted boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = app, pg_temp
AS $$
  SELECT u.id, (u.deleted_at IS NOT NULL)
  FROM app.users u
  WHERE u.zitadel_sub = p_sub
  LIMIT 1;
$$;

-- Idempotent first-login bootstrap: upsert the user (reactivating a paused
-- account) and ensure a profile row exists. Returns { id, created }.
CREATE OR REPLACE FUNCTION app.init_user(p_sub text)
RETURNS TABLE (id text, created boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_id      text;
  v_created boolean;
BEGIN
  WITH ins AS (
    INSERT INTO app.users (id, zitadel_sub, created_at, last_seen_at)
    VALUES (gen_random_uuid(), p_sub, NOW(), NOW())
    ON CONFLICT (zitadel_sub) DO UPDATE
      SET last_seen_at = NOW(), paused_at = NULL
    RETURNING app.users.id, (xmax = 0) AS created
  )
  SELECT i.id, i.created INTO v_id, v_created FROM ins i;

  INSERT INTO app.profiles (id) VALUES (v_id) ON CONFLICT (id) DO NOTHING;

  id := v_id;
  created := v_created;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION app.user_lookup(text)  FROM PUBLIC;
REVOKE ALL ON FUNCTION app.init_user(text)    FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.user_lookup(text) TO heartbits_api;
GRANT EXECUTE ON FUNCTION app.init_user(text)   TO heartbits_api;
