-- Store one 5-letter password per school.
CREATE TABLE IF NOT EXISTS public.school_quiz_passwords (
  school_id integer PRIMARY KEY,
  password_word text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT school_quiz_passwords_password_len CHECK (char_length(trim(password_word)) = 5)
);

ALTER TABLE public.school_quiz_passwords ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_quiz_passwords_select ON public.school_quiz_passwords;
DROP POLICY IF EXISTS school_quiz_passwords_insert ON public.school_quiz_passwords;
DROP POLICY IF EXISTS school_quiz_passwords_update ON public.school_quiz_passwords;
DROP POLICY IF EXISTS school_quiz_passwords_delete ON public.school_quiz_passwords;

CREATE POLICY school_quiz_passwords_select
  ON public.school_quiz_passwords
  FOR SELECT
  USING (true);

CREATE POLICY school_quiz_passwords_insert
  ON public.school_quiz_passwords
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY school_quiz_passwords_update
  ON public.school_quiz_passwords
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY school_quiz_passwords_delete
  ON public.school_quiz_passwords
  FOR DELETE
  USING (true);
