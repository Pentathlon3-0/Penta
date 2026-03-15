-- Fix existing school_quiz_progress tables that were created with owner-based auth constraints.
-- This app allows anonymous participants, so progress writes must not depend on auth.uid().

ALTER TABLE IF EXISTS public.school_quiz_progress ENABLE ROW LEVEL SECURITY;

-- Remove old owner-based policies if they exist.
DROP POLICY IF EXISTS "Allow owners to select their own progress" ON public.school_quiz_progress;
DROP POLICY IF EXISTS "Allow owners to insert their own progress" ON public.school_quiz_progress;
DROP POLICY IF EXISTS "Allow owners to update their own progress" ON public.school_quiz_progress;
DROP POLICY IF EXISTS "Allow owners to delete their row" ON public.school_quiz_progress;
DROP POLICY IF EXISTS "Allow owners to delete their own progress" ON public.school_quiz_progress;

-- Safety net: drop any remaining policy that references owner/auth.uid().
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'school_quiz_progress'
      AND (
        COALESCE(qual, '') ILIKE '%owner%'
        OR COALESCE(with_check, '') ILIKE '%owner%'
        OR COALESCE(qual, '') ILIKE '%auth.uid()%'
        OR COALESCE(with_check, '') ILIKE '%auth.uid()%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.school_quiz_progress', p.policyname);
  END LOOP;
END $$;

-- Remove current public policies first so this migration is re-runnable.
DROP POLICY IF EXISTS "school_quiz_progress_select" ON public.school_quiz_progress;
DROP POLICY IF EXISTS "school_quiz_progress_insert" ON public.school_quiz_progress;
DROP POLICY IF EXISTS "school_quiz_progress_update" ON public.school_quiz_progress;
DROP POLICY IF EXISTS "school_quiz_progress_delete" ON public.school_quiz_progress;

-- If an owner column exists from older schema, drop it.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'school_quiz_progress'
      AND column_name = 'owner'
  ) THEN
    ALTER TABLE public.school_quiz_progress DROP COLUMN owner;
  END IF;
END $$;

-- Normalize nullable rows before enforcing NOT NULL defaults.
UPDATE public.school_quiz_progress
SET
  quiz1_answers = COALESCE(quiz1_answers, '{}'::jsonb),
  quiz1_score = COALESCE(quiz1_score, 0),
  quiz2_answers = COALESCE(quiz2_answers, '{}'::jsonb),
  quiz2_score = COALESCE(quiz2_score, 0),
  updated_at = COALESCE(updated_at, now());

ALTER TABLE public.school_quiz_progress
  ALTER COLUMN quiz1_answers SET DEFAULT '{}'::jsonb,
  ALTER COLUMN quiz1_answers SET NOT NULL,
  ALTER COLUMN quiz1_score SET DEFAULT 0,
  ALTER COLUMN quiz1_score SET NOT NULL,
  ALTER COLUMN quiz2_answers SET DEFAULT '{}'::jsonb,
  ALTER COLUMN quiz2_answers SET NOT NULL,
  ALTER COLUMN quiz2_score SET DEFAULT 0,
  ALTER COLUMN quiz2_score SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

-- Public quiz app policies: allow anonymous read/write.
CREATE POLICY "school_quiz_progress_select" ON public.school_quiz_progress FOR SELECT USING (true);
CREATE POLICY "school_quiz_progress_insert" ON public.school_quiz_progress FOR INSERT WITH CHECK (true);
CREATE POLICY "school_quiz_progress_update" ON public.school_quiz_progress FOR UPDATE USING (true);
CREATE POLICY "school_quiz_progress_delete" ON public.school_quiz_progress FOR DELETE USING (true);
