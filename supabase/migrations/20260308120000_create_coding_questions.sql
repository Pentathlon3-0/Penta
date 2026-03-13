-- ============================================
-- CODING QUESTIONS & BLANKS SCHEMA
-- ============================================

-- Questions table: stores each coding challenge
CREATE TABLE IF NOT EXISTS public.questions (
  id serial PRIMARY KEY,
  title text NOT NULL,
  description text,
  difficulty text NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  html_content text NOT NULL,
  blanks_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS (read-only for everyone)
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view questions"
  ON public.questions FOR SELECT USING (true);

-- Question blanks table: stores each blank and its correct answer
CREATE TABLE IF NOT EXISTS public.question_blanks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id integer NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  blank_id text NOT NULL,
  correct_answer text NOT NULL,
  position integer NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS (read-only for everyone)
ALTER TABLE public.question_blanks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view question blanks"
  ON public.question_blanks FOR SELECT USING (true);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_question_blanks_question_id ON public.question_blanks(question_id);

-- ============================================
-- SAMPLE DATA: Centered Paragraph Question
-- ============================================
INSERT INTO public.questions (id, title, description, difficulty, html_content, blanks_count)
VALUES (
  1,
  'Centered Paragraph',
  'Create a centered paragraph using HTML and inline styles',
  'easy',
  '<__BLANK_1__ style="__BLANK_2__">
  <p>This is a centered paragraph.</p>
</__BLANK_1__>',
  2
) ON CONFLICT DO NOTHING;

-- Blank answers for question 1
INSERT INTO public.question_blanks (question_id, blank_id, correct_answer, position)
VALUES
  (1, 'BLANK_1', 'div', 1),
  (1, 'BLANK_2', 'text-align:center;', 2)
ON CONFLICT DO NOTHING;
