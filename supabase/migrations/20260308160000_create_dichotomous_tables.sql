-- Dichotomous tree question + answer nodes (DB-driven, not hardcoded)

-- Main question table: stores title, animals, features, timer
CREATE TABLE IF NOT EXISTS dichotomous_questions (
  id serial PRIMARY KEY,
  title text NOT NULL,
  description text,
  animals jsonb NOT NULL,          -- e.g. ["நாய்","பூனை",...]
  features jsonb NOT NULL,         -- e.g. ["கால்கள் உண்டு",...]
  timer_seconds integer NOT NULL DEFAULT 180,
  created_at timestamptz DEFAULT now()
);

-- Correct answer nodes: each row is a feature category with its animals
-- For example parent_label="விலங்குகள்", feature_name="கால்கள் உண்டு", animals=["நாய்","பூனை",...]
CREATE TABLE IF NOT EXISTS dichotomous_answer_nodes (
  id serial PRIMARY KEY,
  question_id integer NOT NULL REFERENCES dichotomous_questions(id) ON DELETE CASCADE,
  parent_label text NOT NULL,       -- the node being split, e.g. "விலங்குகள்"
  feature_name text NOT NULL,       -- the feature/category name, e.g. "கால்கள் உண்டு"
  animals jsonb NOT NULL,           -- animals belonging to this feature category
  depth integer NOT NULL DEFAULT 1, -- tree depth (1 = first split, 2 = second split, etc.)
  position integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE dichotomous_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dichotomous_answer_nodes ENABLE ROW LEVEL SECURITY;

-- Anyone can read (public game)
CREATE POLICY "dq_select" ON dichotomous_questions FOR SELECT USING (true);
CREATE POLICY "dan_select" ON dichotomous_answer_nodes FOR SELECT USING (true);

-- Admins can manage
CREATE POLICY "dq_admin_insert" ON dichotomous_questions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "dq_admin_update" ON dichotomous_questions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "dq_admin_delete" ON dichotomous_questions FOR DELETE USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "dan_admin_insert" ON dichotomous_answer_nodes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "dan_admin_update" ON dichotomous_answer_nodes FOR UPDATE USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "dan_admin_delete" ON dichotomous_answer_nodes FOR DELETE USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- ── Sample data ──

INSERT INTO dichotomous_questions (title, description, animals, features, timer_seconds) VALUES (
  'இரும வகைப்பாட்டு மரம் உருவாக்கி',
  'விலங்குகளை வகைப்படுத்துவதற்கு ஒரு இரும வகைப்பாட்டு மரத்தை உருவாக்குங்கள்',
  '["நாய்","பூனை","பெங்குவின்","கூளை","ஆமை","சிங்கம்","சுறா","கழுகு","தவளை","எறும்பு"]'::jsonb,
  '["கால்கள் உண்டு","கால்கள் இல்லை","இறக்கைகள் உண்டு","இறக்கைகள் இல்லை","குளிர் இரத்த விலங்கு","வெப்ப இரத்த விலங்கு","முடி உண்டு","செதில்கள் உண்டு"]'::jsonb,
  180
);

-- Depth 1: root "விலங்குகள்" splits into two feature categories
INSERT INTO dichotomous_answer_nodes (question_id, parent_label, feature_name, animals, depth, position) VALUES
  (1, 'விலங்குகள்', 'கால்கள் உண்டு',  '["நாய்","பூனை","ஆமை","சிங்கம்","தவளை","எறும்பு"]'::jsonb, 1, 1),
  (1, 'விலங்குகள்', 'கால்கள் இல்லை',  '["பெங்குவின்","கூளை","சுறா","கழுகு"]'::jsonb,               1, 2);

-- Depth 2: "கால்கள் உண்டு" splits further
INSERT INTO dichotomous_answer_nodes (question_id, parent_label, feature_name, animals, depth, position) VALUES
  (1, 'கால்கள் உண்டு', 'வெப்ப இரத்த விலங்கு', '["நாய்","பூனை","ஆமை","சிங்கம்"]'::jsonb, 2, 1),
  (1, 'கால்கள் உண்டு', 'குளிர் இரத்த விலங்கு', '["தவளை","எறும்பு"]'::jsonb,               2, 2);

-- Depth 2: "கால்கள் இல்லை" splits further
INSERT INTO dichotomous_answer_nodes (question_id, parent_label, feature_name, animals, depth, position) VALUES
  (1, 'கால்கள் இல்லை', 'இறக்கைகள் உண்டு',  '["பெங்குவின்","கூளை"]'::jsonb, 2, 1),
  (1, 'கால்கள் இல்லை', 'இறக்கைகள் இல்லை', '["சுறா","கழுகு"]'::jsonb,       2, 2);
