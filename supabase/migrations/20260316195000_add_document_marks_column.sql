-- Migration: Add document_marks column to school_quiz_progress
ALTER TABLE public.school_quiz_progress ADD COLUMN document_marks integer NOT NULL DEFAULT 0;
