-- Migration: Seed all form templates from full module spec
-- This migration adds all form templates grouped by department/module
-- Uses DO blocks to check for existence before inserting (idempotent)

-- Helper function to insert form template if it doesn't exist
CREATE OR REPLACE FUNCTION insert_form_template_if_not_exists(
  p_module public.module_type,
  p_name TEXT,
  p_description TEXT,
  p_schema_json JSONB,
  p_is_active BOOLEAN DEFAULT true
) RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.form_templates 
    WHERE module = p_module AND name = p_name
  ) THEN
    INSERT INTO public.form_templates (module, name, description, schema_json, is_active)
    VALUES (p_module, p_name, p_description, p_schema_json, p_is_active);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- NGO Coordination forms
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.form_templates WHERE module = 'ngo_coordination' AND name = 'NGO Intake/Update') THEN
    INSERT INTO public.form_templates (module, name, description, schema_json, is_active) VALUES
      ('ngo_coordination', 'NGO Intake/Update', 'Register or update an NGO partner with contact and jurisdiction details', '{
    "fields": [
      {"name": "legal_name", "type": "text", "label": "Legal Organization Name", "required": true},
      {"name": "common_name", "type": "text", "label": "Common/Display Name"},
      {"name": "bundle", "type": "select", "label": "Bundle", "options": ["Detroit", "Chicago", "US", "Mexican", "African", "Asian"]},
      {"name": "country", "type": "text", "label": "Country"},
      {"name": "state_province", "type": "text", "label": "State/Province"},
      {"name": "city", "type": "text", "label": "City"},
      {"name": "website", "type": "url", "label": "Website"},
      {"name": "fiscal_type", "type": "select", "label": "Fiscal Type", "options": ["model_a", "model_c", "other", "HPG Internal Project"]},
      {"name": "primary_contact_name", "type": "text", "label": "Primary Contact Name", "required": true},
      {"name": "primary_contact_email", "type": "email", "label": "Primary Contact Email", "required": true},
      {"name": "primary_contact_phone", "type": "tel", "label": "Primary Contact Phone"}
    }'::jsonb, true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.form_templates WHERE module = 'ngo_coordination' AND name = 'Monthly NGO Check-in') THEN
    INSERT INTO public.form_templates (module, name, description, schema_json, is_active) VALUES
      ('ngo_coordination', 'Monthly NGO Check-in', 'Record monthly status, activities, and support needs', '{
    "fields": [
      {"name": "activities_completed", "type": "textarea", "label": "Activities Completed This Month", "required": true},
      {"name": "upcoming_activities", "type": "textarea", "label": "Planned Activities Next Month"},
      {"name": "blockers", "type": "textarea", "label": "Current Blockers or Challenges"},
      {"name": "support_needed", "type": "textarea", "label": "Support Needed from HPG"},
      {"name": "highlights", "type": "textarea", "label": "Highlights/Wins to Share"}
    }'::jsonb, true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.form_templates WHERE module = 'ngo_coordination' AND name = 'Document Request') THEN
    INSERT INTO public.form_templates (module, name, description, schema_json, is_active) VALUES
      ('ngo_coordination', 'Document Request', 'Request specific documents from an NGO partner', '{
    "fields": [
      {"name": "document_type", "type": "select", "label": "Document Type", "options": ["W-9", "Insurance Certificate", "Board Resolution", "Financial Statement", "Annual Report", "Other"], "required": true},
      {"name": "description", "type": "textarea", "label": "Description/Instructions"},
      {"name": "due_date", "type": "date", "label": "Due Date", "required": true},
      {"name": "external_visible", "type": "checkbox", "label": "Make visible to NGO portal"}
    }'::jsonb, true);
  END IF;
END $$;

-- Administration forms
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.form_templates WHERE module = 'administration' AND name = 'Monthly VP Departmental Report') THEN
    INSERT INTO public.form_templates (module, name, description, schema_json, is_active) VALUES
      ('administration', 'Monthly VP Departmental Report', 'Submit monthly departmental report to VP', '{
    "fields": [
      {"name": "reporting_period", "type": "date", "label": "Reporting Period", "required": true},
      {"name": "key_achievements", "type": "textarea", "label": "Key Achievements", "required": true},
      {"name": "challenges", "type": "textarea", "label": "Challenges Faced"},
      {"name": "budget_status", "type": "select", "label": "Budget Status", "options": ["On Track", "Over Budget", "Under Budget"]},
      {"name": "next_month_priorities", "type": "textarea", "label": "Next Month Priorities", "required": true}
    ]'::jsonb, true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.form_templates WHERE module = 'administration' AND name = 'Assignment creation request') THEN
    INSERT INTO public.form_templates (module, name, description, schema_json, is_active) VALUES
      ('administration', 'Assignment creation request', 'Request creation of a new assignment or task', '{
    "fields": [
      {"name": "assignment_title", "type": "text", "label": "Assignment Title", "required": true},
      {"name": "description", "type": "textarea", "label": "Description", "required": true},
      {"name": "priority", "type": "select", "label": "Priority", "options": ["Low", "Medium", "High", "Urgent"], "required": true},
      {"name": "due_date", "type": "date", "label": "Due Date"},
      {"name": "assigned_to", "type": "text", "label": "Assigned To (User/Department)"}
    ]'::jsonb, true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.form_templates WHERE module = 'administration' AND name = 'Policy/SOP acknowledgment') THEN
    INSERT INTO public.form_templates (module, name, description, schema_json, is_active) VALUES
      ('administration', 'Policy/SOP acknowledgment', 'Acknowledge receipt and understanding of policy or SOP', '{
    "fields": [
      {"name": "policy_name", "type": "text", "label": "Policy/SOP Name", "required": true},
      {"name": "policy_version", "type": "text", "label": "Version"},
      {"name": "acknowledged", "type": "checkbox", "label": "I acknowledge receipt and understanding", "required": true},
      {"name": "questions", "type": "textarea", "label": "Questions or Concerns"}
    ]'::jsonb, true);
  END IF;
END $$;

-- Operations forms
SELECT insert_form_template_if_not_exists(
  'operations'::public.module_type,
  'Project kickoff',
  'Initiate a new project with kickoff details',
  '{
    "fields": [
      {"name": "project_name", "type": "text", "label": "Project Name", "required": true},
      {"name": "project_description", "type": "textarea", "label": "Project Description", "required": true},
      {"name": "start_date", "type": "date", "label": "Start Date", "required": true},
      {"name": "end_date", "type": "date", "label": "Expected End Date"},
      {"name": "project_lead", "type": "text", "label": "Project Lead", "required": true},
      {"name": "stakeholders", "type": "textarea", "label": "Key Stakeholders"}
    ]
  }'::jsonb,
  true
);

SELECT insert_form_template_if_not_exists(
  'operations'::public.module_type,
  'Weekly status update',
  'Submit weekly project or operational status update',
  '{
    "fields": [
      {"name": "week_ending", "type": "date", "label": "Week Ending", "required": true},
      {"name": "completed_tasks", "type": "textarea", "label": "Completed Tasks", "required": true},
      {"name": "in_progress", "type": "textarea", "label": "In Progress"},
      {"name": "blockers", "type": "textarea", "label": "Blockers"},
      {"name": "next_week_priorities", "type": "textarea", "label": "Next Week Priorities", "required": true}
    ]
  }'::jsonb,
  true
);

-- Program forms
INSERT INTO public.form_templates (module, name, description, schema_json, is_active) VALUES
  ('program', 'Monthly program activity report', 'Report monthly program activities and outcomes', '{
    "fields": [
      {"name": "reporting_period", "type": "date", "label": "Reporting Period", "required": true},
      {"name": "activities_completed", "type": "textarea", "label": "Activities Completed", "required": true},
      {"name": "participants_served", "type": "number", "label": "Participants Served"},
      {"name": "outcomes", "type": "textarea", "label": "Key Outcomes"},
      {"name": "challenges", "type": "textarea", "label": "Challenges"},
      {"name": "next_month_plans", "type": "textarea", "label": "Next Month Plans", "required": true}
    ]
  }'::jsonb, true),
  ('program', 'Incident/issue report', 'Report incidents or issues requiring attention', '{
    "fields": [
      {"name": "incident_date", "type": "date", "label": "Incident Date", "required": true},
      {"name": "incident_type", "type": "select", "label": "Incident Type", "options": ["Safety", "Behavioral", "Program", "Facility", "Other"], "required": true},
      {"name": "description", "type": "textarea", "label": "Description", "required": true},
      {"name": "severity", "type": "select", "label": "Severity", "options": ["Low", "Medium", "High", "Critical"], "required": true},
      {"name": "actions_taken", "type": "textarea", "label": "Actions Taken"},
      {"name": "follow_up_required", "type": "checkbox", "label": "Follow-up Required"}
    ]
  }'::jsonb, true)
ON CONFLICT DO NOTHING;

-- Curriculum forms
INSERT INTO public.form_templates (module, name, description, schema_json, is_active) VALUES
  ('curriculum', 'Curriculum change request', 'Request changes to existing curriculum', '{
    "fields": [
      {"name": "curriculum_name", "type": "text", "label": "Curriculum Name", "required": true},
      {"name": "change_type", "type": "select", "label": "Change Type", "options": ["Content Update", "New Module", "Removal", "Restructure"], "required": true},
      {"name": "rationale", "type": "textarea", "label": "Rationale for Change", "required": true},
      {"name": "proposed_changes", "type": "textarea", "label": "Proposed Changes", "required": true},
      {"name": "impact_assessment", "type": "textarea", "label": "Impact Assessment"}
    ]
  }'::jsonb, true),
  ('curriculum', 'Curriculum publishing checklist', 'Checklist for publishing new or updated curriculum', '{
    "fields": [
      {"name": "curriculum_name", "type": "text", "label": "Curriculum Name", "required": true},
      {"name": "version", "type": "text", "label": "Version Number", "required": true},
      {"name": "review_completed", "type": "checkbox", "label": "Content Review Completed"},
      {"name": "approvals_obtained", "type": "checkbox", "label": "All Approvals Obtained"},
      {"name": "formatting_verified", "type": "checkbox", "label": "Formatting Verified"},
      {"name": "accessibility_checked", "type": "checkbox", "label": "Accessibility Checked"},
      {"name": "ready_to_publish", "type": "checkbox", "label": "Ready to Publish", "required": true}
    ]
  }'::jsonb, true)
ON CONFLICT DO NOTHING;

-- Development forms
INSERT INTO public.form_templates (module, name, description, schema_json, is_active) VALUES
  ('development', 'Grant research update', 'Document grant opportunity research findings', '{
    "fields": [
      {"name": "funder_name", "type": "text", "label": "Funder Name", "required": true},
      {"name": "opportunity_name", "type": "text", "label": "Opportunity/Program Name", "required": true},
      {"name": "amount_range", "type": "text", "label": "Award Amount Range"},
      {"name": "deadline", "type": "date", "label": "Application Deadline"},
      {"name": "fit_score", "type": "select", "label": "Fit Score", "options": ["Low", "Medium", "High"]},
      {"name": "research_notes", "type": "textarea", "label": "Research Notes", "required": true}
    ]
  }'::jsonb, true),
  ('development', 'Opportunity qualification', 'Qualify a grant opportunity for pursuit', '{
    "fields": [
      {"name": "opportunity_name", "type": "text", "label": "Opportunity Name", "required": true},
      {"name": "funder_name", "type": "text", "label": "Funder Name", "required": true},
      {"name": "qualification_score", "type": "select", "label": "Qualification Score", "options": ["Low", "Medium", "High"], "required": true},
      {"name": "strategic_fit", "type": "textarea", "label": "Strategic Fit Assessment", "required": true},
      {"name": "resource_requirements", "type": "textarea", "label": "Resource Requirements"},
      {"name": "recommendation", "type": "select", "label": "Recommendation", "options": ["Pursue", "Decline", "Defer"], "required": true}
    ]
  }'::jsonb, true),
  ('development', 'LOI/proposal submission packet', 'Submit letter of intent or grant proposal for review', '{
    "fields": [
      {"name": "opportunity_name", "type": "text", "label": "Opportunity Name", "required": true},
      {"name": "submission_type", "type": "select", "label": "Submission Type", "options": ["Letter of Intent", "Full Proposal", "Concept Paper"], "required": true},
      {"name": "deadline", "type": "date", "label": "Submission Deadline", "required": true},
      {"name": "requested_amount", "type": "number", "label": "Requested Amount ($)"},
      {"name": "project_summary", "type": "textarea", "label": "Project Summary", "required": true},
      {"name": "attachments_uploaded", "type": "checkbox", "label": "All Required Attachments Uploaded"}
    ]
  }'::jsonb, true),
  ('development', 'Post-award reporting submission', 'Submit required post-award reports', '{
    "fields": [
      {"name": "grant_name", "type": "text", "label": "Grant Name", "required": true},
      {"name": "report_type", "type": "select", "label": "Report Type", "options": ["Progress Report", "Financial Report", "Final Report", "Other"], "required": true},
      {"name": "reporting_period", "type": "text", "label": "Reporting Period", "required": true},
      {"name": "due_date", "type": "date", "label": "Due Date", "required": true},
      {"name": "activities_summary", "type": "textarea", "label": "Activities Summary", "required": true},
      {"name": "budget_status", "type": "textarea", "label": "Budget Status"}
    ]
  }'::jsonb, true)
ON CONFLICT DO NOTHING;

-- Partnership Development forms
INSERT INTO public.form_templates (module, name, description, schema_json, is_active) VALUES
  ('partnerships', 'Partnership intake', 'Intake form for new partnership opportunities', '{
    "fields": [
      {"name": "partner_name", "type": "text", "label": "Partner Organization Name", "required": true},
      {"name": "partner_type", "type": "select", "label": "Partner Type", "options": ["Corporate", "Foundation", "Government", "NGO", "Academic", "Other"], "required": true},
      {"name": "contact_name", "type": "text", "label": "Primary Contact Name", "required": true},
      {"name": "contact_email", "type": "email", "label": "Contact Email", "required": true},
      {"name": "partnership_scope", "type": "textarea", "label": "Partnership Scope", "required": true},
      {"name": "potential_value", "type": "textarea", "label": "Potential Value"}
    ]
  }'::jsonb, true),
  ('partnerships', 'Meeting notes/follow-up', 'Document partnership meeting notes and follow-up actions', '{
    "fields": [
      {"name": "partner_name", "type": "text", "label": "Partner Name", "required": true},
      {"name": "meeting_date", "type": "date", "label": "Meeting Date", "required": true},
      {"name": "attendees", "type": "textarea", "label": "Attendees", "required": true},
      {"name": "meeting_summary", "type": "textarea", "label": "Meeting Summary", "required": true},
      {"name": "key_decisions", "type": "textarea", "label": "Key Decisions"},
      {"name": "action_items", "type": "textarea", "label": "Action Items", "required": true},
      {"name": "next_steps", "type": "textarea", "label": "Next Steps"}
    ]
  }'::jsonb, true),
  ('partnerships', 'MOU/contract request', 'Request creation or review of MOU or partnership contract', '{
    "fields": [
      {"name": "partner_name", "type": "text", "label": "Partner Name", "required": true},
      {"name": "document_type", "type": "select", "label": "Document Type", "options": ["MOU", "Partnership Agreement", "Contract", "Other"], "required": true},
      {"name": "purpose", "type": "textarea", "label": "Purpose", "required": true},
      {"name": "key_terms", "type": "textarea", "label": "Key Terms"},
      {"name": "urgency", "type": "select", "label": "Urgency", "options": ["Low", "Medium", "High"], "required": true},
      {"name": "legal_review_required", "type": "checkbox", "label": "Legal Review Required"}
    ]
  }'::jsonb, true)
ON CONFLICT DO NOTHING;

-- Marketing forms
INSERT INTO public.form_templates (module, name, description, schema_json, is_active) VALUES
  ('marketing', 'Marketing request intake', 'Request marketing support for campaigns or assets', '{
    "fields": [
      {"name": "request_type", "type": "select", "label": "Request Type", "options": ["Flyer/Poster", "Social Media", "Email Campaign", "Website Update", "Video", "Other"], "required": true},
      {"name": "description", "type": "textarea", "label": "Description", "required": true},
      {"name": "target_audience", "type": "text", "label": "Target Audience"},
      {"name": "due_date", "type": "date", "label": "Needed By"},
      {"name": "brand_guidelines", "type": "checkbox", "label": "Follow HPG brand guidelines"}
    ]
  }'::jsonb, true),
  ('marketing', 'Asset request', 'Request marketing assets or materials', '{
    "fields": [
      {"name": "asset_type", "type": "select", "label": "Asset Type", "options": ["Logo", "Brand Guidelines", "Templates", "Photos", "Videos", "Other"], "required": true},
      {"name": "purpose", "type": "textarea", "label": "Purpose", "required": true},
      {"name": "format_required", "type": "text", "label": "Format Required"},
      {"name": "due_date", "type": "date", "label": "Needed By"},
      {"name": "usage_rights", "type": "select", "label": "Usage Rights", "options": ["Internal Only", "External", "Public"]}
    ]
  }'::jsonb, true),
  ('marketing', 'Monthly marketing report', 'Submit monthly marketing activities and metrics report', '{
    "fields": [
      {"name": "reporting_period", "type": "date", "label": "Reporting Period", "required": true},
      {"name": "campaigns_launched", "type": "textarea", "label": "Campaigns Launched", "required": true},
      {"name": "metrics", "type": "textarea", "label": "Key Metrics"},
      {"name": "challenges", "type": "textarea", "label": "Challenges"},
      {"name": "next_month_plans", "type": "textarea", "label": "Next Month Plans", "required": true}
    ]
  }'::jsonb, true)
ON CONFLICT DO NOTHING;

-- Communications forms
INSERT INTO public.form_templates (module, name, description, schema_json, is_active) VALUES
  ('communications', 'Press release request', 'Request creation and distribution of a press release', '{
    "fields": [
      {"name": "title", "type": "text", "label": "Press Release Title", "required": true},
      {"name": "event_date", "type": "date", "label": "Event/Announcement Date"},
      {"name": "key_points", "type": "textarea", "label": "Key Points", "required": true},
      {"name": "target_media", "type": "textarea", "label": "Target Media Outlets"},
      {"name": "distribution_date", "type": "date", "label": "Desired Distribution Date"},
      {"name": "approvals_obtained", "type": "checkbox", "label": "All Approvals Obtained"}
    ]
  }'::jsonb, true),
  ('communications', 'Newsletter issue builder', 'Build content for newsletter issue', '{
    "fields": [
      {"name": "issue_date", "type": "date", "label": "Issue Date", "required": true},
      {"name": "theme", "type": "text", "label": "Theme/Topic"},
      {"name": "featured_stories", "type": "textarea", "label": "Featured Stories", "required": true},
      {"name": "upcoming_events", "type": "textarea", "label": "Upcoming Events"},
      {"name": "call_to_action", "type": "textarea", "label": "Call to Action"}
    ]
  }'::jsonb, true),
  ('communications', 'Internal memo request', 'Request creation and distribution of internal memo', '{
    "fields": [
      {"name": "subject", "type": "text", "label": "Subject", "required": true},
      {"name": "recipients", "type": "select", "label": "Recipients", "options": ["All Staff", "Management", "Department Specific", "Other"], "required": true},
      {"name": "content", "type": "textarea", "label": "Memo Content", "required": true},
      {"name": "priority", "type": "select", "label": "Priority", "options": ["Normal", "Urgent"]},
      {"name": "distribution_date", "type": "date", "label": "Distribution Date"}
    ]
  }'::jsonb, true)
ON CONFLICT DO NOTHING;

-- HR forms
INSERT INTO public.form_templates (module, name, description, schema_json, is_active) VALUES
  ('hr', 'Attendance Form', 'Submit attendance or time tracking information', '{
    "fields": [
      {"name": "employee_name", "type": "text", "label": "Employee Name", "required": true},
      {"name": "period_start", "type": "date", "label": "Period Start", "required": true},
      {"name": "period_end", "type": "date", "label": "Period End", "required": true},
      {"name": "hours_worked", "type": "number", "label": "Hours Worked"},
      {"name": "leave_taken", "type": "select", "label": "Leave Taken", "options": ["None", "Sick Leave", "Vacation", "Personal", "Other"]},
      {"name": "notes", "type": "textarea", "label": "Notes"}
    ]
  }'::jsonb, true),
  ('hr', 'Interview scorecard', 'Record interview feedback and scoring', '{
    "fields": [
      {"name": "candidate_name", "type": "text", "label": "Candidate Name", "required": true},
      {"name": "position", "type": "text", "label": "Position", "required": true},
      {"name": "interview_date", "type": "date", "label": "Interview Date", "required": true},
      {"name": "overall_score", "type": "select", "label": "Overall Score", "options": ["1 - Poor", "2 - Fair", "3 - Good", "4 - Very Good", "5 - Excellent"], "required": true},
      {"name": "strengths", "type": "textarea", "label": "Strengths", "required": true},
      {"name": "concerns", "type": "textarea", "label": "Concerns"},
      {"name": "recommendation", "type": "select", "label": "Recommendation", "options": ["Strong Hire", "Hire", "Maybe", "Do Not Hire"], "required": true}
    ]
  }'::jsonb, true),
  ('hr', 'Offer approval', 'Request approval for job offer', '{
    "fields": [
      {"name": "candidate_name", "type": "text", "label": "Candidate Name", "required": true},
      {"name": "position", "type": "text", "label": "Position", "required": true},
      {"name": "proposed_salary", "type": "number", "label": "Proposed Salary ($)", "required": true},
      {"name": "start_date", "type": "date", "label": "Proposed Start Date", "required": true},
      {"name": "justification", "type": "textarea", "label": "Justification", "required": true},
      {"name": "approval_level", "type": "select", "label": "Approval Level Required", "options": ["Department Head", "VP", "CEO"]}
    ]
  }'::jsonb, true),
  ('hr', 'Staffing Request', 'Request new staff position or replacement', '{
    "fields": [
      {"name": "position_title", "type": "text", "label": "Position Title", "required": true},
      {"name": "department", "type": "text", "label": "Department", "required": true},
      {"name": "request_type", "type": "select", "label": "Request Type", "options": ["New Position", "Replacement", "Temporary"], "required": true},
      {"name": "justification", "type": "textarea", "label": "Justification", "required": true},
      {"name": "budget_impact", "type": "number", "label": "Budget Impact ($)"},
      {"name": "urgency", "type": "select", "label": "Urgency", "options": ["Low", "Medium", "High"], "required": true}
    ]
  }'::jsonb, true)
ON CONFLICT DO NOTHING;

-- IT forms
INSERT INTO public.form_templates (module, name, description, schema_json, is_active) VALUES
  ('it', 'Access request', 'Request access to tools, systems, or accounts', '{
    "fields": [
      {"name": "user_name", "type": "text", "label": "User Full Name", "required": true},
      {"name": "user_email", "type": "email", "label": "User Email", "required": true},
      {"name": "systems", "type": "multiselect", "label": "Systems Needed", "options": ["Google Workspace", "Slack", "Trello", "HPG Workstation", "Drive Access", "Supabase", "Other"], "required": true},
      {"name": "role", "type": "select", "label": "Role/Permission Level", "options": ["Staff", "Manager", "Admin"]},
      {"name": "start_date", "type": "date", "label": "Start Date"},
      {"name": "justification", "type": "textarea", "label": "Justification"}
    ]
  }'::jsonb, true),
  ('it', 'Support ticket', 'Submit IT support request or report an issue', '{
    "fields": [
      {"name": "issue_type", "type": "select", "label": "Issue Type", "options": ["Hardware", "Software", "Network", "Account Access", "Other"], "required": true},
      {"name": "description", "type": "textarea", "label": "Description", "required": true},
      {"name": "severity", "type": "select", "label": "Severity", "options": ["Low", "Medium", "High", "Critical"], "required": true},
      {"name": "affected_users", "type": "text", "label": "Affected Users"},
      {"name": "steps_to_reproduce", "type": "textarea", "label": "Steps to Reproduce"}
    ]
  }'::jsonb, true)
ON CONFLICT DO NOTHING;

-- Finance forms
INSERT INTO public.form_templates (module, name, description, schema_json, is_active) VALUES
  ('finance', 'Expense request', 'Submit expense for reimbursement', '{
    "fields": [
      {"name": "expense_date", "type": "date", "label": "Expense Date", "required": true},
      {"name": "amount", "type": "number", "label": "Amount ($)", "required": true},
      {"name": "category", "type": "select", "label": "Category", "options": ["Travel", "Supplies", "Equipment", "Services", "Meals", "Other"], "required": true},
      {"name": "description", "type": "textarea", "label": "Description", "required": true},
      {"name": "receipt_attached", "type": "checkbox", "label": "Receipt Attached", "required": true}
    ]
  }'::jsonb, true),
  ('finance', 'Payment processing request', 'Request payment processing for approved expenses or invoices', '{
    "fields": [
      {"name": "payee_name", "type": "text", "label": "Payee Name", "required": true},
      {"name": "amount", "type": "number", "label": "Amount ($)", "required": true},
      {"name": "payment_type", "type": "select", "label": "Payment Type", "options": ["Expense Reimbursement", "Vendor Invoice", "Grant Payment", "Other"], "required": true},
      {"name": "due_date", "type": "date", "label": "Due Date"},
      {"name": "account_code", "type": "text", "label": "Account Code"},
      {"name": "approval_attached", "type": "checkbox", "label": "Approval Documentation Attached"}
    ]
  }'::jsonb, true),
  ('finance', 'Budget adjustment request', 'Request budget adjustment or transfer', '{
    "fields": [
      {"name": "from_account", "type": "text", "label": "From Account", "required": true},
      {"name": "to_account", "type": "text", "label": "To Account", "required": true},
      {"name": "amount", "type": "number", "label": "Amount ($)", "required": true},
      {"name": "justification", "type": "textarea", "label": "Justification", "required": true},
      {"name": "approval_required", "type": "select", "label": "Approval Level", "options": ["Department Head", "VP", "CEO"]}
    ]
  }'::jsonb, true),
  ('finance', 'Receipt submission', 'Submit receipt for expense reimbursement', '{
    "fields": [
      {"name": "expense_date", "type": "date", "label": "Expense Date", "required": true},
      {"name": "vendor", "type": "text", "label": "Vendor", "required": true},
      {"name": "amount", "type": "number", "label": "Amount ($)", "required": true},
      {"name": "category", "type": "select", "label": "Category", "options": ["Travel", "Supplies", "Equipment", "Services", "Meals", "Other"], "required": true},
      {"name": "description", "type": "textarea", "label": "Description"},
      {"name": "receipt_uploaded", "type": "checkbox", "label": "Receipt Uploaded", "required": true}
    ]
  }'::jsonb, true)
ON CONFLICT DO NOTHING;

-- Legal/Compliance forms
INSERT INTO public.form_templates (module, name, description, schema_json, is_active) VALUES
  ('legal', 'Contract review request', 'Request legal review of contracts or agreements', '{
    "fields": [
      {"name": "contract_type", "type": "select", "label": "Contract Type", "options": ["Vendor Agreement", "Partnership MOU", "Grant Agreement", "Lease", "Employment", "Other"], "required": true},
      {"name": "counterparty", "type": "text", "label": "Other Party Name", "required": true},
      {"name": "value", "type": "number", "label": "Contract Value ($)"},
      {"name": "urgency", "type": "select", "label": "Urgency", "options": ["Low", "Medium", "High"], "required": true},
      {"name": "key_terms", "type": "textarea", "label": "Key Terms"},
      {"name": "notes", "type": "textarea", "label": "Additional Notes"}
    ]
  }'::jsonb, true),
  ('legal', 'Compliance filing proof', 'Submit evidence of regulatory filing completion', '{
    "fields": [
      {"name": "filing_type", "type": "select", "label": "Filing Type", "options": ["Annual Report", "Tax Filing", "State Registration", "Federal Registration", "Other"], "required": true},
      {"name": "filing_date", "type": "date", "label": "Filing Date", "required": true},
      {"name": "jurisdiction", "type": "text", "label": "Jurisdiction", "required": true},
      {"name": "confirmation_number", "type": "text", "label": "Confirmation/Reference Number"},
      {"name": "documentation_attached", "type": "checkbox", "label": "Documentation Attached", "required": true},
      {"name": "next_due_date", "type": "date", "label": "Next Due Date"}
    ]
  }'::jsonb, true)
ON CONFLICT DO NOTHING;
