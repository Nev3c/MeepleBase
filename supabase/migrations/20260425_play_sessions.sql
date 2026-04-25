-- ============================================================
-- MeepleBase: Play Sessions (geplante + vergangene Multi-Spiel-Abende)
-- Run this in Supabase SQL Editor → Run
-- ============================================================

-- 1. Planned / multi-game sessions
CREATE TABLE IF NOT EXISTS play_sessions (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by    uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title         text,
  session_date  timestamptz NOT NULL,
  location      text,
  notes         text,
  status        text        NOT NULL DEFAULT 'planned'
                            CHECK (status IN ('planned', 'confirmed', 'completed', 'cancelled')),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- 2. Games within a session (multiple allowed)
CREATE TABLE IF NOT EXISTS play_session_games (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id    uuid        REFERENCES play_sessions(id) ON DELETE CASCADE NOT NULL,
  game_id       uuid        REFERENCES games(id) NOT NULL,
  sort_order    int         DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  UNIQUE(session_id, game_id)
);

-- 3. Invitations to planned sessions
CREATE TABLE IF NOT EXISTS play_session_invites (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id        uuid        REFERENCES play_sessions(id) ON DELETE CASCADE NOT NULL,
  invited_user_id   uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status            text        NOT NULL DEFAULT 'invited'
                                CHECK (status IN ('invited', 'accepted', 'declined')),
  responded_at      timestamptz,
  created_at        timestamptz DEFAULT now(),
  UNIQUE(session_id, invited_user_id)
);

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE play_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE play_session_games  ENABLE ROW LEVEL SECURITY;
ALTER TABLE play_session_invites ENABLE ROW LEVEL SECURITY;

-- play_sessions: creator sees all; invitees see sessions they're invited to
CREATE POLICY "play_sessions_select" ON play_sessions FOR SELECT
  USING (
    auth.uid() = created_by
    OR id IN (
      SELECT session_id FROM play_session_invites
      WHERE invited_user_id = auth.uid()
    )
  );
CREATE POLICY "play_sessions_insert" ON play_sessions FOR INSERT
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "play_sessions_update" ON play_sessions FOR UPDATE
  USING (auth.uid() = created_by);
CREATE POLICY "play_sessions_delete" ON play_sessions FOR DELETE
  USING (auth.uid() = created_by);

-- play_session_games: readable if session is readable; writable by creator
CREATE POLICY "play_session_games_select" ON play_session_games FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM play_sessions WHERE created_by = auth.uid()
      UNION
      SELECT session_id FROM play_session_invites WHERE invited_user_id = auth.uid()
    )
  );
CREATE POLICY "play_session_games_all" ON play_session_games FOR ALL
  USING  (session_id IN (SELECT id FROM play_sessions WHERE created_by = auth.uid()))
  WITH CHECK (session_id IN (SELECT id FROM play_sessions WHERE created_by = auth.uid()));

-- play_session_invites: creator manages all; invitee reads + responds to own
CREATE POLICY "play_session_invites_creator" ON play_session_invites FOR ALL
  USING  (session_id IN (SELECT id FROM play_sessions WHERE created_by = auth.uid()))
  WITH CHECK (session_id IN (SELECT id FROM play_sessions WHERE created_by = auth.uid()));
CREATE POLICY "play_session_invites_invitee_select" ON play_session_invites FOR SELECT
  USING (invited_user_id = auth.uid());
CREATE POLICY "play_session_invites_invitee_update" ON play_session_invites FOR UPDATE
  USING (invited_user_id = auth.uid());
