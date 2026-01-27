-- =============================================
-- HPG WORKSTATION DATABASE SCHEMA
-- =============================================
-- ENUM TYPES
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'app_role'
  ) THEN
    CREATE TYPE public.app_role AS ENUM (
      'super_admin',
      'admin_pm',
      'ngo_coordinator',
      'department_lead',
      'staff_member',
      'executive_secretariat',
      'external_ngo'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'ngo_status'
  ) THEN
    CREATE TYPE public.ngo_status AS ENUM (
      'prospect',
      'onboarding',
      'active',
      'at_risk',
      'offboarding',
      'closed'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'fiscal_type'
  ) THEN
    CREATE TYPE public.fiscal_type AS ENUM (
      'model_a',
      'model_c',
      'other'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'work_item_status'
  ) THEN
    CREATE TYPE public.work_item_status AS ENUM (
      'draft',
      'not_started',
      'in_progress',
      'waiting_on_ngo',
      'waiting_on_hpg',
      'submitted',
      'under_review',
      'approved',
      'rejected',
      'complete',
      'canceled'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'priority_level'
  ) THEN
    CREATE TYPE public.priority_level AS ENUM (
      'low',
      'medium',
      'high'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'evidence_status'
  ) THEN
    CREATE TYPE public.evidence_status AS ENUM (
      'missing',
      'uploaded',
      'under_review',
      'approved',
      'rejected'
    );
  END IF;
END $$;
      'super_admin',
      'admin_pm',
      'ngo_coordinator',
      'department_lead',
      'staff_member',
      'executive_secretariat',
      'external_ngo'


CREATE TYPE public.module_type AS ENUM (
  'ngo_coordination',
  'administration',
  'operations',
  'program',
  'curriculum',
  'development',
  'partnership',
  'marketing',
  'communications',
  'hr',
  'it',
  'finance',
  'legal'
);

CREATE TYPE public.document_category AS ENUM (
  'onboarding',
  'compliance',
  'finance',
  'hr',
  'marketing',
  'communications',
  'program',
  'curriculum',
  'it',
  'legal',
  'other'
);

CREATE TYPE public.org_type AS ENUM (
  'ngo',
  'partner',
  'funder',
  'vendor',
  'applicant'
);

-- =============================================
-- BASE TABLES
-- =============================================

-- Org Units (Departments)
CREATE TABLE public.org_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_name TEXT NOT NULL,
  sub_department_name TEXT,
  lead_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  department_id UUID REFERENCES public.org_units(id),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add FK constraint after profiles exists
ALTER TABLE public.org_units 
  ADD CONSTRAINT fk_org_units_lead FOREIGN KEY (lead_user_id) REFERENCES public.profiles(id);

-- User Roles (separate table for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- NGOs
CREATE TABLE public.ngos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name TEXT NOT NULL,
  common_name TEXT,
  bundle TEXT,
  country TEXT,
  state_province TEXT,
  city TEXT,
  website TEXT,
  fiscal_type public.fiscal_type DEFAULT 'other',
  status public.ngo_status DEFAULT 'prospect',
  primary_contact_id UUID,
  ngo_coordinator_user_id UUID REFERENCES public.profiles(id),
  admin_pm_user_id UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Contacts
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id UUID REFERENCES public.ngos(id) ON DELETE CASCADE,
  org_type public.org_type DEFAULT 'ngo',
  name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  phone TEXT,
  location TEXT,
  is_primary BOOLEAN DEFAULT false,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add FK for primary_contact after contacts exists
ALTER TABLE public.ngos 
  ADD CONSTRAINT fk_ngos_primary_contact FOREIGN KEY (primary_contact_id) REFERENCES public.contacts(id);

-- Work Items (universal assignment object)
CREATE TABLE public.work_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id UUID REFERENCES public.ngos(id) ON DELETE SET NULL,
  module public.module_type NOT NULL,
  type TEXT,
  title TEXT NOT NULL,
  description TEXT,
  department_id UUID REFERENCES public.org_units(id),
  owner_user_id UUID REFERENCES public.profiles(id),
  created_by_user_id UUID REFERENCES public.profiles(id),
  status public.work_item_status DEFAULT 'not_started',
  priority public.priority_level DEFAULT 'medium',
  due_date DATE,
  start_date DATE,
  completed_at TIMESTAMPTZ,
  dependencies UUID[] DEFAULT '{}',
  evidence_required BOOLEAN DEFAULT false,
  evidence_status public.evidence_status DEFAULT 'missing',
  approval_required BOOLEAN DEFAULT false,
  approver_user_id UUID REFERENCES public.profiles(id),
  approval_policy JSONB,
  external_visible BOOLEAN DEFAULT false,
  trello_sync BOOLEAN DEFAULT false,
  trello_card_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Form Templates
CREATE TABLE public.form_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module public.module_type NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  schema_json JSONB NOT NULL DEFAULT '{}',
  mapping_json JSONB DEFAULT '{}',
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_by_user_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Form Submissions
CREATE TABLE public.form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_template_id UUID NOT NULL REFERENCES public.form_templates(id),
  work_item_id UUID REFERENCES public.work_items(id),
  ngo_id UUID REFERENCES public.ngos(id),
  submitted_by_user_id UUID REFERENCES public.profiles(id),
  payload_json JSONB NOT NULL DEFAULT '{}',
  submitted_at TIMESTAMPTZ,
  submission_status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Documents
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id UUID REFERENCES public.ngos(id),
  work_item_id UUID REFERENCES public.work_items(id),
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  category public.document_category DEFAULT 'other',
  uploaded_by_user_id UUID REFERENCES public.profiles(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  review_status TEXT DEFAULT 'pending',
  reviewer_user_id UUID REFERENCES public.profiles(id),
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Comments
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_item_id UUID NOT NULL REFERENCES public.work_items(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES public.profiles(id),
  comment_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Approvals
CREATE TABLE public.approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_item_id UUID NOT NULL REFERENCES public.work_items(id) ON DELETE CASCADE,
  reviewer_user_id UUID NOT NULL REFERENCES public.profiles(id),
  decision TEXT,
  notes TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit Log
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES auth.users(id),
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  before_json JSONB,
  after_json JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Template Groups (for generating work items)
CREATE TABLE public.template_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  work_item_templates JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- HELPER FUNCTIONS (SECURITY DEFINER)
-- =============================================

-- Get current user's role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1
$$;

-- Check if user has specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Check if current user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'super_admin')
$$;

-- Check if current user is internal (not external NGO)
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
    AND role IN ('super_admin', 'admin_pm', 'ngo_coordinator', 'department_lead', 'staff_member', 'executive_secretariat')
  )
$$;

-- Check if user has management role (can create/manage work items)
CREATE OR REPLACE FUNCTION public.is_management()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() 
    AND role IN ('super_admin', 'admin_pm', 'executive_secretariat')
  )
$$;

-- Get current user's department
CREATE OR REPLACE FUNCTION public.get_my_department()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT department_id FROM public.profiles WHERE id = auth.uid()
$$;

-- Check if user has access to specific NGO
CREATE OR REPLACE FUNCTION public.has_ngo_access(_ngo_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Super admin or admin PM has access to all
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin_pm')
  ) OR EXISTS (
    -- NGO coordinator assigned to this NGO
    SELECT 1 FROM public.ngos 
    WHERE id = _ngo_id AND ngo_coordinator_user_id = auth.uid()
  ) OR EXISTS (
    -- Admin PM assigned to this NGO
    SELECT 1 FROM public.ngos 
    WHERE id = _ngo_id AND admin_pm_user_id = auth.uid()
  ) OR EXISTS (
    -- External user linked to this NGO via contacts
    SELECT 1 FROM public.contacts 
    WHERE ngo_id = _ngo_id AND user_id = auth.uid()
  )
$$;

-- Check if external user's NGO
CREATE OR REPLACE FUNCTION public.get_my_ngo_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ngo_id FROM public.contacts WHERE user_id = auth.uid() LIMIT 1
$$;

-- =============================================
-- UPDATE TIMESTAMP TRIGGER
-- =============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_org_units_updated_at BEFORE UPDATE ON public.org_units FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ngos_updated_at BEFORE UPDATE ON public.ngos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_work_items_updated_at BEFORE UPDATE ON public.work_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_form_templates_updated_at BEFORE UPDATE ON public.form_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_form_submissions_updated_at BEFORE UPDATE ON public.form_submissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_template_groups_updated_at BEFORE UPDATE ON public.template_groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- ENABLE RLS ON ALL TABLES
-- =============================================

ALTER TABLE public.org_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ngos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_groups ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES
-- =============================================

-- ORG_UNITS: All authenticated can read, management can modify
CREATE POLICY "Anyone can view org units" ON public.org_units FOR SELECT TO authenticated USING (true);
CREATE POLICY "Management can insert org units" ON public.org_units FOR INSERT TO authenticated WITH CHECK (public.is_management());
CREATE POLICY "Management can update org units" ON public.org_units FOR UPDATE TO authenticated USING (public.is_management());
CREATE POLICY "Super admin can delete org units" ON public.org_units FOR DELETE TO authenticated USING (public.is_super_admin());

-- PROFILES: Users see their own, internal sees all
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_internal_user());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Super admin can update any profile" ON public.profiles FOR UPDATE TO authenticated USING (public.is_super_admin());

-- USER_ROLES: Only super admin can manage, users can see own
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_super_admin());
CREATE POLICY "Super admin can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.is_super_admin());

-- NGOS: Based on role and assignment
CREATE POLICY "Internal users can view all NGOs" ON public.ngos FOR SELECT TO authenticated USING (public.is_internal_user());
CREATE POLICY "External users can view own NGO" ON public.ngos FOR SELECT TO authenticated USING (public.has_ngo_access(id));
CREATE POLICY "Management can create NGOs" ON public.ngos FOR INSERT TO authenticated WITH CHECK (public.is_management());
CREATE POLICY "Management can update NGOs" ON public.ngos FOR UPDATE TO authenticated USING (public.is_management() OR public.has_ngo_access(id));
CREATE POLICY "Super admin can delete NGOs" ON public.ngos FOR DELETE TO authenticated USING (public.is_super_admin());

-- CONTACTS: Based on NGO access
CREATE POLICY "View contacts for accessible NGOs" ON public.contacts FOR SELECT TO authenticated USING (public.is_internal_user() OR public.has_ngo_access(ngo_id));
CREATE POLICY "Management can manage contacts" ON public.contacts FOR INSERT TO authenticated WITH CHECK (public.is_management());
CREATE POLICY "Management can update contacts" ON public.contacts FOR UPDATE TO authenticated USING (public.is_management());
CREATE POLICY "Super admin can delete contacts" ON public.contacts FOR DELETE TO authenticated USING (public.is_super_admin());

-- WORK_ITEMS: Complex access based on role
CREATE POLICY "Super admin sees all work items" ON public.work_items FOR SELECT TO authenticated USING (public.is_super_admin());
CREATE POLICY "Admin PM sees all work items" ON public.work_items FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin_pm'));
CREATE POLICY "Owner sees their work items" ON public.work_items FOR SELECT TO authenticated USING (owner_user_id = auth.uid());
CREATE POLICY "Dept lead sees dept work items" ON public.work_items FOR SELECT TO authenticated USING (department_id = public.get_my_department() AND public.has_role(auth.uid(), 'department_lead'));
CREATE POLICY "NGO coordinator sees assigned NGO items" ON public.work_items FOR SELECT TO authenticated USING (public.has_ngo_access(ngo_id) AND public.has_role(auth.uid(), 'ngo_coordinator'));
CREATE POLICY "External sees external visible items" ON public.work_items FOR SELECT TO authenticated USING (external_visible = true AND ngo_id = public.get_my_ngo_id());
CREATE POLICY "Management can create work items" ON public.work_items FOR INSERT TO authenticated WITH CHECK (public.is_management() OR public.has_role(auth.uid(), 'ngo_coordinator'));
CREATE POLICY "Owner can update work items" ON public.work_items FOR UPDATE TO authenticated USING (owner_user_id = auth.uid() OR public.is_management());
CREATE POLICY "Super admin can delete work items" ON public.work_items FOR DELETE TO authenticated USING (public.is_super_admin());

-- FORM_TEMPLATES: Internal users can view, management can modify
CREATE POLICY "Internal users can view templates" ON public.form_templates FOR SELECT TO authenticated USING (public.is_internal_user());
CREATE POLICY "Management can manage templates" ON public.form_templates FOR ALL TO authenticated USING (public.is_management());

-- FORM_SUBMISSIONS: Based on work item access
CREATE POLICY "View own submissions" ON public.form_submissions FOR SELECT TO authenticated USING (submitted_by_user_id = auth.uid() OR public.is_management());
CREATE POLICY "Anyone can create submissions" ON public.form_submissions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Owner can update submissions" ON public.form_submissions FOR UPDATE TO authenticated USING (submitted_by_user_id = auth.uid() OR public.is_management());

-- DOCUMENTS: Based on NGO/work item access
CREATE POLICY "View documents by NGO access" ON public.documents FOR SELECT TO authenticated USING (public.is_internal_user() OR public.has_ngo_access(ngo_id));
CREATE POLICY "Internal users can upload documents" ON public.documents FOR INSERT TO authenticated WITH CHECK (public.is_internal_user());
CREATE POLICY "External can upload to own NGO" ON public.documents FOR INSERT TO authenticated WITH CHECK (ngo_id = public.get_my_ngo_id());
CREATE POLICY "Management can update documents" ON public.documents FOR UPDATE TO authenticated USING (public.is_management() OR uploaded_by_user_id = auth.uid());
CREATE POLICY "Super admin can delete documents" ON public.documents FOR DELETE TO authenticated USING (public.is_super_admin());

-- COMMENTS: View by work item access
CREATE POLICY "View comments on accessible items" ON public.comments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.work_items WHERE id = work_item_id AND (owner_user_id = auth.uid() OR public.is_internal_user()))
);
CREATE POLICY "Auth users can add comments" ON public.comments FOR INSERT TO authenticated WITH CHECK (author_user_id = auth.uid());

-- APPROVALS: Dept leads and management
CREATE POLICY "View own approvals" ON public.approvals FOR SELECT TO authenticated USING (reviewer_user_id = auth.uid() OR public.is_management());
CREATE POLICY "Dept leads can create approvals" ON public.approvals FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'department_lead') OR public.is_management());
CREATE POLICY "Reviewer can update approval" ON public.approvals FOR UPDATE TO authenticated USING (reviewer_user_id = auth.uid());

-- AUDIT_LOG: Super admin only, insert by triggers
CREATE POLICY "Super admin can view audit log" ON public.audit_log FOR SELECT TO authenticated USING (public.is_super_admin());
CREATE POLICY "System can insert audit log" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- TEMPLATE_GROUPS: Internal users can view, management can modify
CREATE POLICY "Internal users can view template groups" ON public.template_groups FOR SELECT TO authenticated USING (public.is_internal_user());
CREATE POLICY "Management can manage template groups" ON public.template_groups FOR ALL TO authenticated USING (public.is_management());

-- =============================================
-- SEED DATA
-- =============================================

-- Departments
INSERT INTO public.org_units (department_name, sub_department_name) VALUES
  ('Administration', NULL),
  ('Administration', 'Executive Secretariat'),
  ('NGO Coordination', NULL),
  ('Operations', NULL),
  ('Program', NULL),
  ('Program', 'Curriculum'),
  ('Development', NULL),
  ('Partnership Development', NULL),
  ('Marketing', NULL),
  ('Communications', NULL),
  ('HR', NULL),
  ('IT', NULL),
  ('Finance', NULL),
  ('Legal', NULL),
  ('Legal', 'Compliance');

-- Template Groups
INSERT INTO public.template_groups (name, description, category, work_item_templates) VALUES
  ('Base Onboarding (Model C)', 'Standard onboarding checklist for Model C NGOs', 'Onboarding', '[
    {"title": "Collect W-9 form", "module": "legal", "department": "Legal", "evidence_required": true},
    {"title": "Fiscal sponsorship agreement", "module": "legal", "department": "Legal", "evidence_required": true, "approval_required": true},
    {"title": "Set up bank account", "module": "finance", "department": "Finance", "evidence_required": true},
    {"title": "Google Workspace setup", "module": "it", "department": "IT"},
    {"title": "Add to HPG systems", "module": "it", "department": "IT"},
    {"title": "Initial coordinator meeting", "module": "ngo_coordination", "department": "NGO Coordination"},
    {"title": "Program orientation", "module": "program", "department": "Program"}
  ]'::jsonb),
  ('Monthly NGO Upkeep', 'Monthly recurring tasks for active NGOs', 'Monthly', '[
    {"title": "Monthly check-in call", "module": "ngo_coordination", "department": "NGO Coordination"},
    {"title": "Expense report collection", "module": "finance", "department": "Finance", "evidence_required": true},
    {"title": "Activity report", "module": "program", "department": "Program", "evidence_required": true}
  ]'::jsonb),
  ('Annual Compliance (Base)', 'Annual compliance tasks', 'Annual', '[
    {"title": "Annual report submission", "module": "legal", "department": "Legal", "evidence_required": true, "approval_required": true},
    {"title": "Insurance renewal", "module": "legal", "department": "Legal", "evidence_required": true},
    {"title": "Board resolution update", "module": "legal", "department": "Legal", "evidence_required": true}
  ]'::jsonb),
  ('Offboarding (Base)', 'NGO offboarding checklist', 'Offboarding', '[
    {"title": "Final financial reconciliation", "module": "finance", "department": "Finance", "evidence_required": true, "approval_required": true},
    {"title": "Asset return", "module": "operations", "department": "Operations"},
    {"title": "Account deactivation", "module": "it", "department": "IT"},
    {"title": "Exit documentation", "module": "legal", "department": "Legal", "evidence_required": true}
  ]'::jsonb);

-- Starter Form Templates
INSERT INTO public.form_templates (module, name, description, schema_json, is_active) VALUES
  ('ngo_coordination', 'NGO Intake Form', 'Initial NGO onboarding intake', '{
    "fields": [
      {"name": "legal_name", "type": "text", "label": "Legal Organization Name", "required": true},
      {"name": "common_name", "type": "text", "label": "Common/Display Name"},
      {"name": "bundle", "type": "select", "label": "Bundle", "options": ["Detroit", "Chicago", "US", "Mexican", "African", "Asian"]},
      {"name": "country", "type": "text", "label": "Country"},
      {"name": "state_province", "type": "text", "label": "State/Province"},
      {"name": "city", "type": "text", "label": "City"},
      {"name": "website", "type": "url", "label": "Website"},
      {"name": "fiscal_type", "type": "select", "label": "Fiscal Type", "options": ["Model A", "Model C", "Other"]},
      {"name": "primary_contact_name", "type": "text", "label": "Primary Contact Name", "required": true},
      {"name": "primary_contact_email", "type": "email", "label": "Primary Contact Email", "required": true},
      {"name": "primary_contact_phone", "type": "tel", "label": "Primary Contact Phone"}
    ]
  }'::jsonb, true),
  ('ngo_coordination', 'Monthly NGO Check-in', 'Monthly progress and status update', '{
    "fields": [
      {"name": "activities_completed", "type": "textarea", "label": "Activities Completed This Month", "required": true},
      {"name": "upcoming_activities", "type": "textarea", "label": "Planned Activities Next Month"},
      {"name": "blockers", "type": "textarea", "label": "Current Blockers or Challenges"},
      {"name": "support_needed", "type": "textarea", "label": "Support Needed from HPG"},
      {"name": "highlights", "type": "textarea", "label": "Highlights/Wins to Share"}
    ]
  }'::jsonb, true),
  ('ngo_coordination', 'Document Request', 'Request documents from NGO', '{
    "fields": [
      {"name": "document_type", "type": "select", "label": "Document Type", "options": ["W-9", "Insurance Certificate", "Board Resolution", "Financial Statement", "Annual Report", "Other"], "required": true},
      {"name": "description", "type": "textarea", "label": "Description/Instructions"},
      {"name": "due_date", "type": "date", "label": "Due Date", "required": true},
      {"name": "external_visible", "type": "checkbox", "label": "Make visible to NGO portal"}
    ]
  }'::jsonb, true),
  ('finance', 'Expense Request', 'Submit expense for reimbursement', '{
    "fields": [
      {"name": "expense_date", "type": "date", "label": "Expense Date", "required": true},
      {"name": "amount", "type": "number", "label": "Amount ($)", "required": true},
      {"name": "category", "type": "select", "label": "Category", "options": ["Travel", "Supplies", "Equipment", "Services", "Other"], "required": true},
      {"name": "description", "type": "textarea", "label": "Description", "required": true},
      {"name": "receipt_attached", "type": "checkbox", "label": "Receipt Attached"}
    ]
  }'::jsonb, true),
  ('hr', 'Access Request', 'Request system access for new user', '{
    "fields": [
      {"name": "user_name", "type": "text", "label": "User Full Name", "required": true},
      {"name": "user_email", "type": "email", "label": "User Email", "required": true},
      {"name": "systems", "type": "multiselect", "label": "Systems Needed", "options": ["Google Workspace", "Slack", "Trello", "HPG Workstation", "Drive Access"]},
      {"name": "role", "type": "select", "label": "Role/Permission Level", "options": ["Staff", "Manager", "Admin"]},
      {"name": "start_date", "type": "date", "label": "Start Date"}
    ]
  }'::jsonb, true),
  ('legal', 'Contract Review Request', 'Submit contract for legal review', '{
    "fields": [
      {"name": "contract_type", "type": "select", "label": "Contract Type", "options": ["Vendor Agreement", "Partnership MOU", "Grant Agreement", "Lease", "Other"], "required": true},
      {"name": "counterparty", "type": "text", "label": "Other Party Name", "required": true},
      {"name": "value", "type": "number", "label": "Contract Value ($)"},
      {"name": "urgency", "type": "select", "label": "Urgency", "options": ["Low", "Medium", "High"], "required": true},
      {"name": "notes", "type": "textarea", "label": "Additional Notes"}
    ]
  }'::jsonb, true),
  ('marketing', 'Marketing Request', 'Request marketing support', '{
    "fields": [
      {"name": "request_type", "type": "select", "label": "Request Type", "options": ["Flyer/Poster", "Social Media", "Email Campaign", "Website Update", "Video", "Other"], "required": true},
      {"name": "description", "type": "textarea", "label": "Description", "required": true},
      {"name": "target_audience", "type": "text", "label": "Target Audience"},
      {"name": "due_date", "type": "date", "label": "Needed By"},
      {"name": "brand_guidelines", "type": "checkbox", "label": "Follow HPG brand guidelines"}
    ]
  }'::jsonb, true),
  ('development', 'Grant Opportunity', 'Log a potential grant opportunity', '{
    "fields": [
      {"name": "funder_name", "type": "text", "label": "Funder Name", "required": true},
      {"name": "opportunity_name", "type": "text", "label": "Opportunity/Program Name", "required": true},
      {"name": "amount_range", "type": "text", "label": "Award Amount Range"},
      {"name": "deadline", "type": "date", "label": "Application Deadline"},
      {"name": "fit_score", "type": "select", "label": "Fit Score", "options": ["Low", "Medium", "High"]},
      {"name": "notes", "type": "textarea", "label": "Notes"}
    ]
  }'::jsonb, true);