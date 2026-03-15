-- Persist awarded letters per school to avoid overlap and support refresh restore.
ALTER TABLE IF EXISTS public.school_quiz_progress
  ADD COLUMN IF NOT EXISTS letters_given jsonb DEFAULT '{}'::jsonb;

UPDATE public.school_quiz_progress
SET letters_given = COALESCE(letters_given, '{}'::jsonb);

ALTER TABLE public.school_quiz_progress
  ALTER COLUMN letters_given SET DEFAULT '{}'::jsonb,
  ALTER COLUMN letters_given SET NOT NULL;
