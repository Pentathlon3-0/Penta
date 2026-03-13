-- Add question_id column to quiz_scores so each school+question pair is unique

ALTER TABLE quiz_scores ADD COLUMN IF NOT EXISTS question_id integer REFERENCES dichotomous_questions(id) ON DELETE SET NULL;

-- Drop the old unique index (school_name only)
DROP INDEX IF EXISTS quiz_scores_school_name_unique;

-- Create new unique index on (school_name, question_id)
CREATE UNIQUE INDEX IF NOT EXISTS quiz_scores_school_question_unique ON quiz_scores (school_name, question_id);
