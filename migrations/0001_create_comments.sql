-- Comments and notes left on trips and individual trip days.
--
-- user_id / user_email are unused today (anyone may post) and exist so the
-- planned Google auth can start filling them without a schema change.
-- metadata / llm_processed_at / llm_result are for downstream LLM passes.
CREATE TABLE IF NOT EXISTS comments (
  id               TEXT PRIMARY KEY,
  trip_id          TEXT NOT NULL,
  day_id           TEXT,
  kind             TEXT NOT NULL DEFAULT 'comment' CHECK (kind IN ('comment', 'note')),
  author           TEXT NOT NULL DEFAULT 'anonymous',
  body             TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  user_id          TEXT,
  user_email       TEXT,
  metadata         TEXT,
  llm_processed_at TEXT,
  llm_result       TEXT
);

CREATE INDEX IF NOT EXISTS idx_comments_trip_created
  ON comments (trip_id, created_at);

CREATE INDEX IF NOT EXISTS idx_comments_trip_day_created
  ON comments (trip_id, day_id, created_at);

-- Supports the `unprocessed=1` filter on /api/export.
CREATE INDEX IF NOT EXISTS idx_comments_unprocessed
  ON comments (created_at) WHERE llm_processed_at IS NULL;
