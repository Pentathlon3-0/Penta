-- Track whether each school has already submitted each quiz.
ALTER TABLE IF EXISTS public.school_quiz_progress
  ADD COLUMN IF NOT EXISTS quiz1_submitted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS quiz2_submitted boolean DEFAULT false;

UPDATE public.school_quiz_progress
SET
  quiz1_submitted = COALESCE(quiz1_submitted, false),
  quiz2_submitted = COALESCE(quiz2_submitted, false);

ALTER TABLE public.school_quiz_progress
  ALTER COLUMN quiz1_submitted SET DEFAULT false,
  ALTER COLUMN quiz1_submitted SET NOT NULL,
  ALTER COLUMN quiz2_submitted SET DEFAULT false,
  ALTER COLUMN quiz2_submitted SET NOT NULL;
