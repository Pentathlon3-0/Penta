-- Add timer_seconds column to questions table (default 600 = 10 minutes)
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS timer_seconds integer NOT NULL DEFAULT 600;
