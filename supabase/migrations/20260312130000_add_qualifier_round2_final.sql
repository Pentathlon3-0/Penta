-- add new column for qualifier round 2 final score
ALTER TABLE public.livescore
  ADD COLUMN qualifier_round2_final integer;

-- set default 0 for convenience (nullable allowed)
ALTER TABLE public.livescore
  ALTER COLUMN qualifier_round2_final SET DEFAULT 0;
