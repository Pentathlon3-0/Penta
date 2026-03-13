-- Fix RLS policy on user_roles to avoid recursion

-- drop the existing policy if it exists
DROP POLICY IF EXISTS "Only admins can manage roles" ON public.user_roles;

-- recreate policy using helper function to prevent recursive query
CREATE POLICY "Only admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid())
  );
