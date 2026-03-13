-- Add default member role for new users

-- ensure user_roles table exists (safe if already created)
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.app_role NOT NULL,
    UNIQUE (user_id, role)
);

-- update the signup trigger/function to also insert a default role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- create the profile as before
    INSERT INTO public.profiles (user_id, email)
    VALUES (NEW.id, NEW.email);

    -- give every new user the 'member' role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'member');

    RETURN NEW;
END;
$$;

-- make sure trigger exists (will not duplicate if already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END
$$;
