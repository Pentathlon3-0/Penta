-- Update school password constraint to 7 letters
ALTER TABLE public.school_quiz_passwords
DROP CONSTRAINT IF EXISTS school_quiz_passwords_password_len;

ALTER TABLE public.school_quiz_passwords
ADD CONSTRAINT school_quiz_passwords_password_len CHECK (char_length(trim(password_word)) = 7);

-- Optionally backfill existing rows with 7-letter placeholder values if needed
UPDATE public.school_quiz_passwords
SET password_word = 'ABCDEFG'
WHERE char_length(trim(password_word)) <> 7;
