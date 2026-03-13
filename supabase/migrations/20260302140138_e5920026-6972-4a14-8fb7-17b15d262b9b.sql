
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('member', 'admin', 'super_admin');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by authenticated users" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Roles viewable by authenticated users" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Only admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to check if user is admin or super_admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin', 'super_admin')
  )
$$;

-- Create bazar_presses table
CREATE TABLE public.bazar_presses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_name TEXT NOT NULL,
  pressed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  press_count INTEGER NOT NULL DEFAULT 1,
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bazar_presses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view bazar presses" ON public.bazar_presses FOR SELECT USING (true);
CREATE POLICY "Anyone can insert bazar presses" ON public.bazar_presses FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update bazar presses" ON public.bazar_presses FOR UPDATE USING (true);
CREATE POLICY "Only admins can delete bazar presses" ON public.bazar_presses FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- Create coding_submissions table
CREATE TABLE public.coding_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_name TEXT NOT NULL,
  percentage NUMERIC NOT NULL DEFAULT 0,
  check_attempts INTEGER NOT NULL DEFAULT 0,
  final_output TEXT,
  submitted BOOLEAN NOT NULL DEFAULT false,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.coding_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view coding submissions" ON public.coding_submissions FOR SELECT USING (true);
CREATE POLICY "Anyone can insert coding submissions" ON public.coding_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update coding submissions" ON public.coding_submissions FOR UPDATE USING (true);
CREATE POLICY "Only admins can delete coding submissions" ON public.coding_submissions FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- Trigger for profile creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable realtime for bazar and coding tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.bazar_presses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.coding_submissions;
