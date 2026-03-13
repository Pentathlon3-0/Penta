-- Stores in-progress tree state so refresh doesn't lose work
CREATE TABLE IF NOT EXISTS dichotomous_user_trees (
  id serial PRIMARY KEY,
  school_name text NOT NULL,
  question_id integer NOT NULL REFERENCES dichotomous_questions(id) ON DELETE CASCADE,
  tree_data jsonb NOT NULL,
  timer_remaining integer NOT NULL DEFAULT 180,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (school_name, question_id)
);

ALTER TABLE dichotomous_user_trees ENABLE ROW LEVEL SECURITY;

-- Anyone can read/write (public game, no auth required)
CREATE POLICY "user_trees_select" ON dichotomous_user_trees FOR SELECT USING (true);
CREATE POLICY "user_trees_insert" ON dichotomous_user_trees FOR INSERT WITH CHECK (true);
CREATE POLICY "user_trees_update" ON dichotomous_user_trees FOR UPDATE USING (true);
CREATE POLICY "user_trees_delete" ON dichotomous_user_trees FOR DELETE USING (true);
