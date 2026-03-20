-- Migration: Add correct_blanks column to coding_submissions
ALTER TABLE public.coding_submissions ADD COLUMN correct_blanks INTEGER NOT NULL DEFAULT 0;