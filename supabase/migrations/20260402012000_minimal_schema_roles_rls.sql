-- =============================================
-- Minimal schema adjustments for Phase A
-- =============================================

-- Profiles role column + checks
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT;

UPDATE public.profiles
SET role = COALESCE(role, 'staff');

ALTER TABLE public.profiles
  ALTER COLUMN role SET NOT NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin','admin_pm','ngo_coordinator','department_lead','staff','executive_secretariat','external_portal'));

-- Org unit lead now references auth.users
ALTER TABLE public.org_units
  DROP CONSTRAINT IF EXISTS fk_org_units_lead;

ALTER TABLE public.org_units
  ADD CONSTRAINT org_units_lead_user_id_fkey
  FOREIGN KEY (lead_user_id) REFERENCES auth.users(id);

-- Work items owner/creator references auth.users
ALTER TABLE public.work_items
  DROP CONSTRAINT IF EXISTS work_items_owner_user_id_fkey;

ALTER TABLE public.work_items
  DROP CONSTRAINT IF EXISTS work_items_created_by_user_id_fkey;

ALTER TABLE public.work_items
  ADD CONSTRAINT work_items_owner_user_id_fkey
  FOREIGN KEY (owner_user_id) REFERENCES auth.users(id);

ALTER TABLE public.work_items
  ADD CONSTRAINT work_items_created_by_user_id_fkey
  FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id);

ALTER TABLE public.work_items
  ALTER COLUMN created_by_user_id SET NOT NULL;

-- Comments author references auth.users
ALTER TABLE public.comments
  DROP CONSTRAINT IF EXISTS comments_author_user_id_fkey;

ALTER TABLE public.comments
  ADD CONSTRAINT comments_author_user_id_fkey
  FOREIGN KEY (author_user_id) REFERENCES auth.users(id);

-- NGO text enums (status/fiscal_type) to match minimal schema
ALTER TABLE public.ngos
  ALTER COLUMN fiscal_type TYPE text USING
    CASE fiscal_type
      WHEN 'model_a' THEN 'Model A'
      WHEN 'model_c' THEN 'Model C'
      ELSE 'Other'
    END,
  ALTER COLUMN status TYPE text USING
    CASE status
      WHEN 'prospect' THEN 'Prospect'
      WHEN 'onboarding' THEN 'Onboarding'
      WHEN 'active' THEN 'Active'
      WHEN 'at_risk' THEN 'At-Risk'
      WHEN 'offboarding' THEN 'Offboarding'
      ELSE 'Closed'
    END;

ALTER TABLE public.ngos
  ALTER COLUMN fiscal_type SET DEFAULT 'Other',
  ALTER COLUMN status SET DEFAULT 'Prospect';

ALTER TABLE public.ngos
  DROP CONSTRAINT IF EXISTS ngos_fiscal_type_check;

ALTER TABLE public.ngos
  ADD CONSTRAINT ngos_fiscal_type_check
  CHECK (fiscal_type IN ('Model A','Model C','Other'));

ALTER TABLE public.ngos
  DROP CONSTRAINT IF EXISTS ngos_status_check;

ALTER TABLE public.ngos
  ADD CONSTRAINT ngos_status_check
  CHECK (status IN ('Prospect','Onboarding','Active','At-Risk','Offboarding','Closed'));

-- Work items status/priority + module as text
ALTER TABLE public.work_items
  ALTER COLUMN module TYPE text USING module::text,
  ALTER COLUMN status TYPE text USING
    CASE status
      WHEN 'draft' THEN 'Draft'
      WHEN 'not_started' THEN 'Not Started'
      WHEN 'in_progress' THEN 'In Progress'
      WHEN 'waiting_on_ngo' THEN 'Waiting on NGO'
      WHEN 'waiting_on_hpg' THEN 'Waiting on HPG'
      WHEN 'submitted' THEN 'Submitted'
      WHEN 'under_review' THEN 'Under Review'
      WHEN 'approved' THEN 'Approved'
      WHEN 'rejected' THEN 'Rejected'
      WHEN 'complete' THEN 'Complete'
      ELSE 'Canceled'
    END,
  ALTER COLUMN priority TYPE text USING
    CASE priority
      WHEN 'low' THEN 'Low'
      WHEN 'medium' THEN 'Med'
      ELSE 'High'
    END;

ALTER TABLE public.work_items
  ALTER COLUMN status SET DEFAULT 'Not Started',
  ALTER COLUMN priority SET DEFAULT 'Med';

ALTER TABLE public.work_items
  DROP CONSTRAINT IF EXISTS work_items_status_check;

ALTER TABLE public.work_items
  ADD CONSTRAINT work_items_status_check
  CHECK (status IN (
    'Draft','Not Started','In Progress','Waiting on NGO','Waiting on HPG',
    'Submitted','Under Review','Approved','Rejected','Complete','Canceled'
  ));

ALTER TABLE public.work_items
  DROP CONSTRAINT IF EXISTS work_items_priority_check;

ALTER TABLE public.work_items
  ADD CONSTRAINT work_items_priority_check
  CHECK (priority IN ('Low','Med','High'));

-- Audit log requirements
ALTER TABLE public.audit_log
  ALTER COLUMN actor_user_id SET NOT NULL,
  ALTER COLUMN entity_id SET NOT NULL;

-- =============================================
-- RLS updates
-- =============================================

ALTER TABLE public.org_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ngos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view org units" ON public.org_units;
DROP POLICY IF EXISTS "Management can insert org units" ON public.org_units;
DROP POLICY IF EXISTS "Management can update org units" ON public.org_units;
DROP POLICY IF EXISTS "Super admin can delete org units" ON public.org_units;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Super admin can update any profile" ON public.profiles;

DROP POLICY IF EXISTS "Internal users can view all NGOs" ON public.ngos;
DROP POLICY IF EXISTS "External users can view own NGO" ON public.ngos;
DROP POLICY IF EXISTS "Management can create NGOs" ON public.ngos;
DROP POLICY IF EXISTS "Management can update NGOs" ON public.ngos;
DROP POLICY IF EXISTS "Super admin can delete NGOs" ON public.ngos;

DROP POLICY IF EXISTS "Super admin sees all work items" ON public.work_items;
DROP POLICY IF EXISTS "Admin PM sees all work items" ON public.work_items;
DROP POLICY IF EXISTS "Owner sees their work items" ON public.work_items;
DROP POLICY IF EXISTS "Dept lead sees dept work items" ON public.work_items;
DROP POLICY IF EXISTS "NGO coordinator sees assigned NGO items" ON public.work_items;
DROP POLICY IF EXISTS "External sees external visible items" ON public.work_items;
DROP POLICY IF EXISTS "Management can create work items" ON public.work_items;
DROP POLICY IF EXISTS "Owner can update work items" ON public.work_items;
DROP POLICY IF EXISTS "Super admin can delete work items" ON public.work_items;

DROP POLICY IF EXISTS "View comments on accessible items" ON public.comments;
DROP POLICY IF EXISTS "Auth users can add comments" ON public.comments;

DROP POLICY IF EXISTS "Super admin can view audit log" ON public.audit_log;
DROP POLICY IF EXISTS "System can insert audit log" ON public.audit_log;

-- PROFILES
CREATE POLICY "Users can view own profile or super admin view"
  ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ORG_UNITS
CREATE POLICY "Org units readable by authenticated users"
  ON public.org_units
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Super admin can insert org units"
  ON public.org_units
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

CREATE POLICY "Super admin can update org units"
  ON public.org_units
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

CREATE POLICY "Super admin can delete org units"
  ON public.org_units
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

-- NGOS
CREATE POLICY "Super admin can manage NGOs"
  ON public.ngos
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

CREATE POLICY "Admin PM can view NGOs"
  ON public.ngos
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin_pm')
  );

CREATE POLICY "Admin PM can create NGOs"
  ON public.ngos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin_pm')
  );

CREATE POLICY "Admin PM can update NGOs"
  ON public.ngos
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin_pm')
  );

CREATE POLICY "NGO coordinators can view assigned NGOs"
  ON public.ngos
  FOR SELECT TO authenticated
  USING (ngo_coordinator_user_id = auth.uid());

CREATE POLICY "Department staff can view owned NGOs"
  ON public.ngos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('department_lead','staff')
    )
    AND EXISTS (
      SELECT 1 FROM public.work_items wi
      WHERE wi.ngo_id = ngos.id
        AND wi.owner_user_id = auth.uid()
    )
  );

-- WORK_ITEMS
CREATE POLICY "Super admin can manage work items"
  ON public.work_items
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

CREATE POLICY "Admin PM can view work items"
  ON public.work_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin_pm')
  );

CREATE POLICY "Owners and creators can view work items"
  ON public.work_items
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR created_by_user_id = auth.uid());

CREATE POLICY "Department leads can view department work items"
  ON public.work_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'department_lead'
        AND p.department_id = work_items.department_id
    )
  );

CREATE POLICY "Users can create own work items"
  ON public.work_items
  FOR INSERT TO authenticated
  WITH CHECK (created_by_user_id = auth.uid());

CREATE POLICY "Owners and creators can update work items"
  ON public.work_items
  FOR UPDATE TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR created_by_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin_pm')
  );

-- COMMENTS
CREATE POLICY "Readable comments for accessible work items"
  ON public.comments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.work_items wi
      WHERE wi.id = comments.work_item_id
        AND (
          wi.owner_user_id = auth.uid()
          OR wi.created_by_user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin_pm'))
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'department_lead'
              AND p.department_id = wi.department_id
          )
        )
    )
  );

CREATE POLICY "Writable comments for accessible work items"
  ON public.comments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.work_items wi
      WHERE wi.id = comments.work_item_id
        AND (
          wi.owner_user_id = auth.uid()
          OR wi.created_by_user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin_pm'))
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'department_lead'
              AND p.department_id = wi.department_id
          )
        )
    )
  );

-- AUDIT_LOG
CREATE POLICY "Admins can view audit logs"
  ON public.audit_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin_pm'))
  );

CREATE POLICY "Authenticated users can insert audit logs"
  ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- =============================================
-- Seed org units (idempotent)
-- =============================================
INSERT INTO public.org_units (department_name, sub_department_name)
SELECT 'Administration', 'Executive Secretariat'
WHERE NOT EXISTS (
  SELECT 1 FROM public.org_units
  WHERE department_name = 'Administration' AND sub_department_name = 'Executive Secretariat'
);

INSERT INTO public.org_units (department_name, sub_department_name)
SELECT 'NGO Coordination', NULL
WHERE NOT EXISTS (SELECT 1 FROM public.org_units WHERE department_name = 'NGO Coordination' AND sub_department_name IS NULL);

INSERT INTO public.org_units (department_name, sub_department_name)
SELECT 'Operations', NULL
WHERE NOT EXISTS (SELECT 1 FROM public.org_units WHERE department_name = 'Operations' AND sub_department_name IS NULL);

INSERT INTO public.org_units (department_name, sub_department_name)
SELECT 'Program', NULL
WHERE NOT EXISTS (SELECT 1 FROM public.org_units WHERE department_name = 'Program' AND sub_department_name IS NULL);

INSERT INTO public.org_units (department_name, sub_department_name)
SELECT 'Program', 'Curriculum'
WHERE NOT EXISTS (
  SELECT 1 FROM public.org_units
  WHERE department_name = 'Program' AND sub_department_name = 'Curriculum'
);

INSERT INTO public.org_units (department_name, sub_department_name)
SELECT 'Development', NULL
WHERE NOT EXISTS (SELECT 1 FROM public.org_units WHERE department_name = 'Development' AND sub_department_name IS NULL);

INSERT INTO public.org_units (department_name, sub_department_name)
SELECT 'Partnership Development', NULL
WHERE NOT EXISTS (SELECT 1 FROM public.org_units WHERE department_name = 'Partnership Development' AND sub_department_name IS NULL);

INSERT INTO public.org_units (department_name, sub_department_name)
SELECT 'Marketing', NULL
WHERE NOT EXISTS (SELECT 1 FROM public.org_units WHERE department_name = 'Marketing' AND sub_department_name IS NULL);

INSERT INTO public.org_units (department_name, sub_department_name)
SELECT 'Communications', NULL
WHERE NOT EXISTS (SELECT 1 FROM public.org_units WHERE department_name = 'Communications' AND sub_department_name IS NULL);

INSERT INTO public.org_units (department_name, sub_department_name)
SELECT 'HR', NULL
WHERE NOT EXISTS (SELECT 1 FROM public.org_units WHERE department_name = 'HR' AND sub_department_name IS NULL);

INSERT INTO public.org_units (department_name, sub_department_name)
SELECT 'IT', NULL
WHERE NOT EXISTS (SELECT 1 FROM public.org_units WHERE department_name = 'IT' AND sub_department_name IS NULL);

INSERT INTO public.org_units (department_name, sub_department_name)
SELECT 'Finance', NULL
WHERE NOT EXISTS (SELECT 1 FROM public.org_units WHERE department_name = 'Finance' AND sub_department_name IS NULL);

INSERT INTO public.org_units (department_name, sub_department_name)
SELECT 'Legal', NULL
WHERE NOT EXISTS (SELECT 1 FROM public.org_units WHERE department_name = 'Legal' AND sub_department_name IS NULL);
