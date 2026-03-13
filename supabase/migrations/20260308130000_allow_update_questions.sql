-- Allow authenticated users to update questions and question_blanks
-- (Admin-only enforcement is handled at the app level)

CREATE POLICY "Authenticated users can update questions"
  ON public.questions FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update question blanks"
  ON public.question_blanks FOR UPDATE
  USING (true)
  WITH CHECK (true);
