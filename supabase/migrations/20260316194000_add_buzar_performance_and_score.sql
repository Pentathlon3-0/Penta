-- Add buzar_performance (jsonb) and buzar_score (integer) columns to final_round
ALTER TABLE final_round
ADD COLUMN IF NOT EXISTS buzar_performance jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS buzar_score integer DEFAULT 0;
