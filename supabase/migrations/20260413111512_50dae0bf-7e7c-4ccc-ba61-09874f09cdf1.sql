
-- Add approval columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending';

-- Mark all existing users as approved
UPDATE public.profiles SET is_approved = true, approval_status = 'approved';

-- Update the auto_assign_first_admin function to also auto-approve the first user
CREATE OR REPLACE FUNCTION public.auto_assign_first_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles LIMIT 1) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'super_admin');
    -- Auto-approve the first admin
    UPDATE public.profiles SET is_approved = true, approval_status = 'approved' WHERE id = NEW.id;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'staff_member');
    -- New users remain unapproved (defaults apply)
  END IF;
  RETURN NEW;
END;
$function$;

-- Add validation trigger for approval_status
CREATE OR REPLACE FUNCTION public.validate_approval_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.approval_status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid approval status: %', NEW.approval_status;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER validate_profile_approval_status
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.validate_approval_status();
