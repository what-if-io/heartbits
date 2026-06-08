-- HeartBits migration 009 — rich persisted chat
-- Extends app.messages (reply / edit / soft-delete / attachment) and adds
-- per-message reactions. Idempotent.

ALTER TABLE app.messages
  ADD COLUMN IF NOT EXISTS reply_to_id         TEXT REFERENCES app.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS edited_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attachment_media_id TEXT;

-- ── Reactions ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.message_reactions (
  id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  message_id  TEXT        NOT NULL REFERENCES app.messages(id) ON DELETE CASCADE,
  user_id     TEXT        NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  emoji       TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);
CREATE INDEX IF NOT EXISTS message_reactions_message_idx ON app.message_reactions (message_id);

ALTER TABLE app.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.message_reactions FORCE ROW LEVEL SECURITY;

-- Read reactions on messages in a match you're part of; write only your own.
DROP POLICY IF EXISTS message_reactions_read ON app.message_reactions;
CREATE POLICY message_reactions_read ON app.message_reactions
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM app.messages msg
    JOIN app.matches mt ON mt.id = msg.match_id
    WHERE msg.id = message_id
      AND (mt.user_a_id = current_setting('app.current_user_id', true)
        OR mt.user_b_id = current_setting('app.current_user_id', true))
  ));

DROP POLICY IF EXISTS message_reactions_write ON app.message_reactions;
CREATE POLICY message_reactions_write ON app.message_reactions
  FOR ALL
  USING (user_id = current_setting('app.current_user_id', true))
  WITH CHECK (user_id = current_setting('app.current_user_id', true));
