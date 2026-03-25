
-- Auto-assign super_admin role to new users when no roles exist yet (bootstrap)
CREATE OR REPLACE FUNCTION public.auto_assign_first_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If no user_roles exist yet, make this user super_admin
  IF NOT EXISTS (SELECT 1 FROM public.user_roles LIMIT 1) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'super_admin');
  ELSE
    -- Default new users to staff_member
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'staff_member');
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger after profile creation (which happens on signup)
DROP TRIGGER IF EXISTS trg_auto_assign_role ON public.profiles;
CREATE TRIGGER trg_auto_assign_role
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_first_admin();
