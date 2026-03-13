-- ensure authenticated users can upsert into livescore
ALTER TABLE public.livescore ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated upsert on livescore" ON public.livescore;
CREATE POLICY "Allow authenticated upsert on livescore"
  ON public.livescore
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- redefine notify function to avoid inserting into non-existent table
-- the previous function attempted to insert into live_notifications,
-- which lacks a school_id column, causing 42703 errors and failing the
-- upsert.  Instead we simply notify on a channel; the front-end already
-- listens on "livescore-realtime" so this preserves behaviour without
-- requiring any additional table.

CREATE OR REPLACE FUNCTION public.notify_livescore_change()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  PERFORM pg_notify('livescore-realtime', row_to_json(NEW)::text);
  RETURN NEW;
END;
$$;
