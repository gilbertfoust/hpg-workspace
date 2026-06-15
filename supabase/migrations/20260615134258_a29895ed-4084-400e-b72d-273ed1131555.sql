
-- Add missing columns the app expects
ALTER TABLE public.work_items ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT;

-- Backfill profiles.role from user_roles (one role per user; pick highest-priority if multiple)
UPDATE public.profiles p
SET role = ur.role::text
FROM public.user_roles ur
WHERE ur.user_id = p.id AND p.role IS NULL;

-- Keep profiles.role in sync with user_roles going forward
CREATE OR REPLACE FUNCTION public.sync_profile_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.profiles SET role = NULL WHERE id = OLD.user_id;
    RETURN OLD;
  ELSE
    UPDATE public.profiles SET role = NEW.role::text WHERE id = NEW.user_id;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_role ON public.user_roles;
CREATE TRIGGER trg_sync_profile_role
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_role();
