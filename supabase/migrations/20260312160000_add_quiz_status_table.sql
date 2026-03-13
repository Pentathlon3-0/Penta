-- create a table to track whether each quiz is enabled
CREATE TABLE IF NOT EXISTS public.quiz_status (
  id serial PRIMARY KEY,
  quiz1_enabled boolean NOT NULL DEFAULT false,
  quiz2_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ensure there's always a row (id=1)
INSERT INTO public.quiz_status (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.quiz_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_status ON public.quiz_status
  FOR SELECT USING (true);

CREATE POLICY update_status ON public.quiz_status
  FOR UPDATE USING (true);
