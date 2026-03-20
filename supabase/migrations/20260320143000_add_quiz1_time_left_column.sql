-- Migration: Add quiz1_time_left column to school_quiz_progress
ALTER TABLE IF EXISTS public.school_quiz_progress
ADD COLUMN IF NOT EXISTS quiz1_time_left integer NOT NULL DEFAULT 300;

-- Backfill existing rows with default 300 where null (defensive)
UPDATE public.school_quiz_progress
SET quiz1_time_left = 300
WHERE quiz1_time_left IS NULL;
