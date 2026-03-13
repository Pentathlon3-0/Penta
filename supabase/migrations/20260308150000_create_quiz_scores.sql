-- Create quiz_scores table for the Dichotomous Tree Builder game

CREATE TABLE IF NOT EXISTS quiz_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 10,
  tree_data jsonb,
  created_at timestamptz DEFAULT now()
);

-- Each school can only have one submission (prevents duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS quiz_scores_school_name_unique ON quiz_scores (school_name);

-- Enable RLS
ALTER TABLE quiz_scores ENABLE ROW LEVEL SECURITY;

-- Anyone can read scores
CREATE POLICY "quiz_scores_select" ON quiz_scores FOR SELECT USING (true);

-- Anyone can insert (public game page)
CREATE POLICY "quiz_scores_insert" ON quiz_scores FOR INSERT WITH CHECK (true);

-- Admins can update / delete
CREATE POLICY "quiz_scores_update" ON quiz_scores FOR UPDATE USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "quiz_scores_delete" ON quiz_scores FOR DELETE USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);


