-- Add user_answer column to dichotomous_user_trees
ALTER TABLE dichotomous_user_trees
ADD COLUMN user_answer jsonb;