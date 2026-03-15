-- Stores quiz progress for each school so users can refresh without losing their answers
-- Uses a simple schema (no owner/auth required) because this is a PUBLIC quiz game with anonymous participants
CREATE TABLE IF NOT EXISTS school_quiz_progress (
  school_name text PRIMARY KEY,
  quiz1_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  quiz1_score integer NOT NULL DEFAULT 0,
  quiz2_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  quiz2_score integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE school_quiz_progress ENABLE ROW LEVEL SECURITY;

-- Anyone can read/write quiz progress (public game, no auth required)
DROP POLICY IF EXISTS "school_quiz_progress_select" ON school_quiz_progress;
DROP POLICY IF EXISTS "school_quiz_progress_insert" ON school_quiz_progress;
DROP POLICY IF EXISTS "school_quiz_progress_update" ON school_quiz_progress;
DROP POLICY IF EXISTS "school_quiz_progress_delete" ON school_quiz_progress;

CREATE POLICY "school_quiz_progress_select" ON school_quiz_progress FOR SELECT USING (true);
CREATE POLICY "school_quiz_progress_insert" ON school_quiz_progress FOR INSERT WITH CHECK (true);
CREATE POLICY "school_quiz_progress_update" ON school_quiz_progress FOR UPDATE USING (true);
CREATE POLICY "school_quiz_progress_delete" ON school_quiz_progress FOR DELETE USING (true);
