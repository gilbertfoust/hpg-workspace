-- User Access Bundle backend: calendar events, upload notifications,
-- potential sponsees, profile avatars, admin records FK fix, role expansion.

-- ---------------------------------------------------------------------------
-- Role expansion (profiles + app_role enum)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  ALTER TYPE public.app_role ADD VALUE 'staff';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.app_role ADD VALUE 'ngo_user';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.app_role ADD VALUE 'vp_operations';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.app_role ADD VALUE 'vp_programs';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.app_role ADD VALUE 'vp_development';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.app_role ADD VALUE 'vp_finance';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.app_role ADD VALUE 'vp_communications';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.app_role ADD VALUE 'viewer';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.app_role ADD VALUE 'board';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN (
    'super_admin',
    'admin_pm',
    'ngo_coordinator',
    'department_lead',
    'staff',
    'staff_member',
    'executive_secretariat',
    'external_portal',
    'external_ngo',
    'ngo_user',
    'vp_operations',
    'vp_programs',
    'vp_development',
    'vp_finance',
    'vp_communications',
    'viewer',
    'board'
  ));

CREATE OR REPLACE FUNCTION public.is_internal_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role::text IN (
        'super_admin',
        'admin_pm',
        'ngo_coordinator',
        'department_lead',
        'staff_member',
        'staff',
        'executive_secretariat',
        'vp_operations',
        'vp_programs',
        'vp_development',
        'vp_finance',
        'vp_communications'
      )
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN (
        'super_admin',
        'admin_pm',
        'ngo_coordinator',
        'department_lead',
        'staff_member',
        'staff',
        'executive_secretariat',
        'vp_operations',
        'vp_programs',
        'vp_development',
        'vp_finance',
        'vp_communications'
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'admin_pm')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'admin_pm')
    );
$$;

-- ---------------------------------------------------------------------------
-- Calendar events
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'calendar_event_type'
  ) THEN
    CREATE TYPE public.calendar_event_type AS ENUM (
      'meeting', 'deadline', 'birthday', 'compliance', 'training', 'other'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  event_type public.calendar_event_type NOT NULL DEFAULT 'other',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  description text,
  ngo_id uuid REFERENCES public.ngos(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.org_units(id) ON DELETE SET NULL,
  created_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_starts_at ON public.calendar_events(starts_at);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "calendar events readable by authenticated" ON public.calendar_events;
CREATE POLICY "calendar events readable by authenticated"
  ON public.calendar_events FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "calendar events writable by admins" ON public.calendar_events;
CREATE POLICY "calendar events writable by admins"
  ON public.calendar_events FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

DROP TRIGGER IF EXISTS update_calendar_events_updated_at ON public.calendar_events;
CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Upload notification events
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.upload_notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_item_id uuid NOT NULL REFERENCES public.work_items(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  module text NOT NULL,
  department_id uuid REFERENCES public.org_units(id) ON DELETE SET NULL,
  notification_type text NOT NULL CHECK (notification_type IN ('slack', 'email')),
  notification_status text NOT NULL DEFAULT 'queued'
    CHECK (notification_status IN ('queued', 'sent', 'skipped', 'failed')),
  recipient text,
  error_message text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_upload_notification_events_status
  ON public.upload_notification_events(notification_status);
CREATE INDEX IF NOT EXISTS idx_upload_notification_events_work_item
  ON public.upload_notification_events(work_item_id);

ALTER TABLE public.upload_notification_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "upload notifications readable by authenticated" ON public.upload_notification_events;
CREATE POLICY "upload notifications readable by authenticated"
  ON public.upload_notification_events FOR SELECT TO authenticated USING (public.is_internal_user());

DROP POLICY IF EXISTS "upload notifications insertable by authenticated" ON public.upload_notification_events;
CREATE POLICY "upload notifications insertable by authenticated"
  ON public.upload_notification_events FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_user());

DROP POLICY IF EXISTS "upload notifications updatable by internal users" ON public.upload_notification_events;
CREATE POLICY "upload notifications updatable by internal users"
  ON public.upload_notification_events FOR UPDATE TO authenticated
  USING (public.is_internal_user())
  WITH CHECK (public.is_internal_user());

-- ---------------------------------------------------------------------------
-- Potential sponsees pipeline
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'sponsee_outreach_status'
  ) THEN
    CREATE TYPE public.sponsee_outreach_status AS ENUM (
      'research', 'contacted', 'in_conversation', 'on_hold', 'declined', 'converted'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.potential_sponsees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_name text NOT NULL,
  country text,
  state_province text,
  city text,
  contact_person text,
  email text,
  phone text,
  website text,
  mission_area text,
  sponsorship_fit text,
  outreach_status public.sponsee_outreach_status NOT NULL DEFAULT 'research',
  next_follow_up_date date,
  assigned_owner_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text,
  created_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_potential_sponsees_outreach
  ON public.potential_sponsees(outreach_status);
CREATE INDEX IF NOT EXISTS idx_potential_sponsees_follow_up
  ON public.potential_sponsees(next_follow_up_date);

ALTER TABLE public.potential_sponsees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "potential sponsees readable by staff" ON public.potential_sponsees;
CREATE POLICY "potential sponsees readable by staff"
  ON public.potential_sponsees FOR SELECT TO authenticated USING (public.is_internal_user());

DROP POLICY IF EXISTS "potential sponsees writable by internal users" ON public.potential_sponsees;
CREATE POLICY "potential sponsees writable by internal users"
  ON public.potential_sponsees FOR ALL TO authenticated
  USING (public.is_internal_user())
  WITH CHECK (public.is_internal_user());

DROP TRIGGER IF EXISTS update_potential_sponsees_updated_at ON public.potential_sponsees;
CREATE TRIGGER update_potential_sponsees_updated_at
  BEFORE UPDATE ON public.potential_sponsees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Work item admin records FK fix (org_units, not departments)
-- ---------------------------------------------------------------------------

ALTER TABLE public.work_item_admin_records
  DROP CONSTRAINT IF EXISTS work_item_admin_records_department_id_fkey;

UPDATE public.work_item_admin_records war
SET department_id = NULL
WHERE department_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.org_units ou WHERE ou.id = war.department_id
  );

ALTER TABLE public.work_item_admin_records
  ADD CONSTRAINT work_item_admin_records_department_id_fkey
  FOREIGN KEY (department_id) REFERENCES public.org_units(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.complete_work_item_for_admin_records(_work_item_id uuid, _notes text DEFAULT NULL)
RETURNS public.work_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item public.work_items;
  resolved_department_id uuid;
BEGIN
  IF NOT public.is_internal_user() THEN
    RAISE EXCEPTION 'Internal staff access required';
  END IF;

  UPDATE public.work_items
  SET status = 'complete',
      completed_at = COALESCE(completed_at, now()),
      archived_at = COALESCE(archived_at, now()),
      archived_by_user_id = COALESCE(archived_by_user_id, auth.uid()),
      archive_reason = COALESCE(_notes, 'Completed and sent to admin records'),
      updated_at = now()
  WHERE id = _work_item_id
  RETURNING * INTO item;

  IF item.id IS NULL THEN
    RAISE EXCEPTION 'Work item not found';
  END IF;

  resolved_department_id := item.department_id;
  IF resolved_department_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.org_units ou WHERE ou.id = resolved_department_id) THEN
    resolved_department_id := NULL;
  END IF;

  INSERT INTO public.work_item_admin_records (
    work_item_id,
    title,
    module,
    department_id,
    ngo_id,
    completed_by_user_id,
    completed_at,
    archive_reason,
    notes,
    snapshot_json
  ) VALUES (
    item.id,
    item.title,
    item.module,
    resolved_department_id,
    item.ngo_id,
    auth.uid(),
    COALESCE(item.completed_at, now()),
    COALESCE(_notes, 'Completed and sent to admin records'),
    _notes,
    to_jsonb(item)
  )
  ON CONFLICT (work_item_id) DO UPDATE
  SET title = EXCLUDED.title,
      module = EXCLUDED.module,
      department_id = EXCLUDED.department_id,
      ngo_id = EXCLUDED.ngo_id,
      completed_by_user_id = EXCLUDED.completed_by_user_id,
      completed_at = EXCLUDED.completed_at,
      archive_reason = EXCLUDED.archive_reason,
      notes = EXCLUDED.notes,
      snapshot_json = EXCLUDED.snapshot_json;

  RETURN item;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_work_item_for_admin_records(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.complete_work_item_for_admin_records(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Profile avatars storage bucket
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-avatars',
  'profile-avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "avatar images are publicly readable" ON storage.objects;
CREATE POLICY "avatar images are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-avatars');

DROP POLICY IF EXISTS "users can upload own avatar" ON storage.objects;
CREATE POLICY "users can upload own avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "users can update own avatar" ON storage.objects;
CREATE POLICY "users can update own avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "admins can upload any avatar" ON storage.objects;
CREATE POLICY "admins can upload any avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'profile-avatars'
    AND public.is_admin_user()
  );

DROP POLICY IF EXISTS "admins can update any avatar" ON storage.objects;
CREATE POLICY "admins can update any avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'profile-avatars' AND public.is_admin_user())
  WITH CHECK (bucket_id = 'profile-avatars' AND public.is_admin_user());
