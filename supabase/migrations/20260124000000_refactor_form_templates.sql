-- Form Templates Refactoring Migration
-- This migration restructures forms according to new requirements:
-- - Removes redundant forms
-- - Moves forms between departments
-- - Adds document upload section to all forms
-- - Adds Director to VP weekly report for each department
-- - Consolidates departments (Curriculum -> Program, NGO Coordination -> Program)

-- Step 1: Create unique index on (module, name) if it doesn't exist
CREATE UNIQUE INDEX IF NOT EXISTS form_templates_module_name_unique 
ON public.form_templates (module, name);

-- Step 2: Delete forms that should be removed
DELETE FROM public.form_templates WHERE (module, name) IN (
  ('ngo_coordination', 'NGO Intake/Update'),
  ('ngo_coordination', 'Document Request'),
  ('administration', 'Assignment creation request'),
  ('administration', 'Policy/SOP acknowledgment'),
  ('development', 'Opportunity qualification'),
  ('partnership', 'Partnership intake'),
  ('partnership', 'Meeting notes/follow-up'),
  ('partnership', 'MOU/contract request'),
  ('marketing', 'Asset request'),
  ('marketing', 'Monthly marketing report'),
  ('hr', 'Access request'),
  ('hr', 'Staffing Request'),
  ('hr', 'Staffing recruitment request'),
  ('hr', 'Offer approval'),
  ('finance', 'Expense request'),
  ('legal', 'Contract review request')
);

-- Step 3: Update existing forms (change descriptions, add document upload)
-- Receipt submission: change description to "For bookkeeping"
UPDATE public.form_templates 
SET description = 'For bookkeeping'
WHERE module = 'finance' AND name = 'Receipt submission';

-- Newsletter issue builder: rename to Newsletter Content Submission
UPDATE public.form_templates 
SET name = 'Newsletter Content Submission',
    description = 'Submit content for newsletter issue'
WHERE module = 'communications' AND name = 'Newsletter issue builder';

-- Step 4: Create upsert helper function
CREATE OR REPLACE FUNCTION upsert_form_template(
  p_module public.module_type,
  p_name TEXT,
  p_description TEXT,
  p_schema_json JSONB,
  p_is_active BOOLEAN DEFAULT true
) RETURNS void AS $$
BEGIN
  INSERT INTO public.form_templates (module, name, description, schema_json, is_active)
  VALUES (p_module, p_name, p_description, p_schema_json, p_is_active)
  ON CONFLICT (module, name) 
  DO UPDATE SET
    description = EXCLUDED.description,
    schema_json = EXCLUDED.schema_json,
    is_active = EXCLUDED.is_active,
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- Step 5: Move forms from Partnership to Development
-- Partnership intake -> Development
UPDATE public.form_templates 
SET module = 'development'::public.module_type
WHERE module = 'partnership'::public.module_type AND name = 'Partnership intake';

-- Meeting notes/follow-up -> Development
UPDATE public.form_templates 
SET module = 'development'::public.module_type
WHERE module = 'partnership'::public.module_type AND name = 'Meeting notes/follow-up';

-- MOU/contract request -> Development
UPDATE public.form_templates 
SET module = 'development'::public.module_type
WHERE module = 'partnership'::public.module_type AND name = 'MOU/contract request';

-- Step 6: Move forms from Curriculum to Program
UPDATE public.form_templates 
SET module = 'program'::public.module_type
WHERE module = 'curriculum'::public.module_type;

-- Step 7: Move forms from NGO Coordination to Program
UPDATE public.form_templates 
SET module = 'program'::public.module_type
WHERE module = 'ngo_coordination'::public.module_type;

-- Step 8: Add document upload section to all existing forms
UPDATE public.form_templates
SET schema_json = jsonb_set(
  schema_json,
  '{fields}',
  COALESCE(schema_json->'fields', '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object(
      'name', 'documents',
      'type', 'file',
      'label', 'Attach Documents',
      'multiple', true,
      'accept', 'application/pdf,image/*,.doc,.docx,.xls,.xlsx'
    )
  )
)
WHERE schema_json->'fields' IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM jsonb_array_elements(schema_json->'fields') AS field
    WHERE field->>'name' = 'documents'
  );

-- Step 9: Seed all form templates with document upload sections included

-- Administration (2 forms + weekly report)
SELECT upsert_form_template(
  'administration'::public.module_type,
  'Monthly VP Departmental Report',
  'Submit monthly departmental report to VP',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('name', 'reporting_period', 'type', 'date', 'label', 'Reporting Period', 'required', true),
    jsonb_build_object('name', 'key_achievements', 'type', 'textarea', 'label', 'Key Achievements', 'required', true),
    jsonb_build_object('name', 'challenges', 'type', 'textarea', 'label', 'Challenges Faced'),
    jsonb_build_object('name', 'budget_status', 'type', 'select', 'label', 'Budget Status', 'options', jsonb_build_array('On Track', 'Over Budget', 'Under Budget')),
    jsonb_build_object('name', 'next_month_priorities', 'type', 'textarea', 'label', 'Next Month Priorities', 'required', true),
    jsonb_build_object('name', 'documents', 'type', 'file', 'label', 'Attach Documents', 'multiple', true, 'accept', 'application/pdf,image/*,.doc,.docx,.xls,.xlsx')
  )),
  true
);

SELECT upsert_form_template(
  'administration'::public.module_type,
  'Director to VP Weekly Report',
  'Weekly report from Director to VP',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('name', 'week_ending', 'type', 'date', 'label', 'Week Ending', 'required', true),
    jsonb_build_object('name', 'key_highlights', 'type', 'textarea', 'label', 'Key Highlights', 'required', true),
    jsonb_build_object('name', 'completed_objectives', 'type', 'textarea', 'label', 'Completed Objectives', 'required', true),
    jsonb_build_object('name', 'challenges', 'type', 'textarea', 'label', 'Challenges'),
    jsonb_build_object('name', 'next_week_priorities', 'type', 'textarea', 'label', 'Next Week Priorities', 'required', true),
    jsonb_build_object('name', 'documents', 'type', 'file', 'label', 'Attach Documents', 'multiple', true, 'accept', 'application/pdf,image/*,.doc,.docx,.xls,.xlsx')
  )),
  true
);

-- Operations (2 forms + weekly report)
SELECT upsert_form_template(
  'operations'::public.module_type,
  'Project kickoff',
  'Initiate a new project with kickoff details',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('name', 'project_name', 'type', 'text', 'label', 'Project Name', 'required', true),
    jsonb_build_object('name', 'project_description', 'type', 'textarea', 'label', 'Project Description', 'required', true),
    jsonb_build_object('name', 'start_date', 'type', 'date', 'label', 'Start Date', 'required', true),
    jsonb_build_object('name', 'end_date', 'type', 'date', 'label', 'Expected End Date'),
    jsonb_build_object('name', 'project_lead', 'type', 'text', 'label', 'Project Lead', 'required', true),
    jsonb_build_object('name', 'stakeholders', 'type', 'textarea', 'label', 'Key Stakeholders'),
    jsonb_build_object('name', 'documents', 'type', 'file', 'label', 'Attach Documents', 'multiple', true, 'accept', 'application/pdf,image/*,.doc,.docx,.xls,.xlsx')
  )),
  true
);

SELECT upsert_form_template(
  'operations'::public.module_type,
  'Weekly status update',
  'Submit weekly project or operational status update',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('name', 'week_ending', 'type', 'date', 'label', 'Week Ending', 'required', true),
    jsonb_build_object('name', 'completed_tasks', 'type', 'textarea', 'label', 'Completed Tasks', 'required', true),
    jsonb_build_object('name', 'in_progress', 'type', 'textarea', 'label', 'In Progress'),
    jsonb_build_object('name', 'blockers', 'type', 'textarea', 'label', 'Blockers'),
    jsonb_build_object('name', 'next_week_priorities', 'type', 'textarea', 'label', 'Next Week Priorities', 'required', true),
    jsonb_build_object('name', 'documents', 'type', 'file', 'label', 'Attach Documents', 'multiple', true, 'accept', 'application/pdf,image/*,.doc,.docx,.xls,.xlsx')
  )),
  true
);

SELECT upsert_form_template(
  'operations'::public.module_type,
  'Director to VP Weekly Report',
  'Weekly report from Director to VP',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('name', 'week_ending', 'type', 'date', 'label', 'Week Ending', 'required', true),
    jsonb_build_object('name', 'key_highlights', 'type', 'textarea', 'label', 'Key Highlights', 'required', true),
    jsonb_build_object('name', 'completed_objectives', 'type', 'textarea', 'label', 'Completed Objectives', 'required', true),
    jsonb_build_object('name', 'challenges', 'type', 'textarea', 'label', 'Challenges'),
    jsonb_build_object('name', 'next_week_priorities', 'type', 'textarea', 'label', 'Next Week Priorities', 'required', true),
    jsonb_build_object('name', 'documents', 'type', 'file', 'label', 'Attach Documents', 'multiple', true, 'accept', 'application/pdf,image/*,.doc,.docx,.xls,.xlsx')
  )),
  true
);

-- Program (includes moved forms from Curriculum and NGO Coordination + weekly report)
SELECT upsert_form_template(
  'program'::public.module_type,
  'Monthly program activity report',
  'Report monthly program activities and outcomes',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('name', 'reporting_period', 'type', 'date', 'label', 'Reporting Period', 'required', true),
    jsonb_build_object('name', 'activities_completed', 'type', 'textarea', 'label', 'Activities Completed', 'required', true),
    jsonb_build_object('name', 'participants_served', 'type', 'number', 'label', 'Participants Served'),
    jsonb_build_object('name', 'outcomes', 'type', 'textarea', 'label', 'Key Outcomes'),
    jsonb_build_object('name', 'challenges', 'type', 'textarea', 'label', 'Challenges'),
    jsonb_build_object('name', 'next_month_plans', 'type', 'textarea', 'label', 'Next Month Plans', 'required', true),
    jsonb_build_object('name', 'documents', 'type', 'file', 'label', 'Attach Documents', 'multiple', true, 'accept', 'application/pdf,image/*,.doc,.docx,.xls,.xlsx')
  )),
  true
);

SELECT upsert_form_template(
  'program'::public.module_type,
  'Incident/issue report',
  'Report incidents or issues requiring attention',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('name', 'incident_date', 'type', 'date', 'label', 'Incident Date', 'required', true),
    jsonb_build_object('name', 'incident_type', 'type', 'select', 'label', 'Incident Type', 'options', jsonb_build_array('Safety', 'Behavioral', 'Program', 'Facility', 'Other'), 'required', true),
    jsonb_build_object('name', 'description', 'type', 'textarea', 'label', 'Description', 'required', true),
    jsonb_build_object('name', 'severity', 'type', 'select', 'label', 'Severity', 'options', jsonb_build_array('Low', 'Medium', 'High', 'Critical'), 'required', true),
    jsonb_build_object('name', 'actions_taken', 'type', 'textarea', 'label', 'Actions Taken'),
    jsonb_build_object('name', 'follow_up_required', 'type', 'checkbox', 'label', 'Follow-up Required'),
    jsonb_build_object('name', 'documents', 'type', 'file', 'label', 'Attach Documents', 'multiple', true, 'accept', 'application/pdf,image/*,.doc,.docx,.xls,.xlsx')
  )),
  true
);

SELECT upsert_form_template(
  'program'::public.module_type,
  'Curriculum change request',
  'Request changes to existing curriculum',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('name', 'curriculum_name', 'type', 'text', 'label', 'Curriculum Name', 'required', true),
    jsonb_build_object('name', 'change_type', 'type', 'select', 'label', 'Change Type', 'options', jsonb_build_array('Content Update', 'New Module', 'Removal', 'Restructure'), 'required', true),
    jsonb_build_object('name', 'rationale', 'type', 'textarea', 'label', 'Rationale for Change', 'required', true),
    jsonb_build_object('name', 'proposed_changes', 'type', 'textarea', 'label', 'Proposed Changes', 'required', true),
    jsonb_build_object('name', 'impact_assessment', 'type', 'textarea', 'label', 'Impact Assessment'),
    jsonb_build_object('name', 'documents', 'type', 'file', 'label', 'Attach Documents', 'multiple', true, 'accept', 'application/pdf,image/*,.doc,.docx,.xls,.xlsx')
  )),
  true
);

SELECT upsert_form_template(
  'program'::public.module_type,
  'Curriculum publishing checklist',
  'Checklist for publishing new or updated curriculum',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('name', 'curriculum_name', 'type', 'text', 'label', 'Curriculum Name', 'required', true),
    jsonb_build_object('name', 'version', 'type', 'text', 'label', 'Version Number', 'required', true),
    jsonb_build_object('name', 'review_completed', 'type', 'checkbox', 'label', 'Content Review Completed'),
    jsonb_build_object('name', 'approvals_obtained', 'type', 'checkbox', 'label', 'All Approvals Obtained'),
    jsonb_build_object('name', 'formatting_verified', 'type', 'checkbox', 'label', 'Formatting Verified'),
    jsonb_build_object('name', 'accessibility_checked', 'type', 'checkbox', 'label', 'Accessibility Checked'),
    jsonb_build_object('name', 'ready_to_publish', 'type', 'checkbox', 'label', 'Ready to Publish', 'required', true),
    jsonb_build_object('name', 'documents', 'type', 'file', 'label', 'Attach Documents', 'multiple', true, 'accept', 'application/pdf,image/*,.doc,.docx,.xls,.xlsx')
  )),
  true
);

SELECT upsert_form_template(
  'program'::public.module_type,
  'Monthly NGO Check-in',
  'Record monthly status, activities, and support needs',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('name', 'activities_completed', 'type', 'textarea', 'label', 'Activities Completed This Month', 'required', true),
    jsonb_build_object('name', 'upcoming_activities', 'type', 'textarea', 'label', 'Planned Activities Next Month'),
    jsonb_build_object('name', 'blockers', 'type', 'textarea', 'label', 'Current Blockers or Challenges'),
    jsonb_build_object('name', 'support_needed', 'type', 'textarea', 'label', 'Support Needed from HPG'),
    jsonb_build_object('name', 'highlights', 'type', 'textarea', 'label', 'Highlights/Wins to Share'),
    jsonb_build_object('name', 'documents', 'type', 'file', 'label', 'Attach Documents', 'multiple', true, 'accept', 'application/pdf,image/*,.doc,.docx,.xls,.xlsx')
  )),
  true
);

SELECT upsert_form_template(
  'program'::public.module_type,
  'Director to VP Weekly Report',
  'Weekly report from Director to VP',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('name', 'week_ending', 'type', 'date', 'label', 'Week Ending', 'required', true),
    jsonb_build_object('name', 'key_highlights', 'type', 'textarea', 'label', 'Key Highlights', 'required', true),
    jsonb_build_object('name', 'completed_objectives', 'type', 'textarea', 'label', 'Completed Objectives', 'required', true),
    jsonb_build_object('name', 'challenges', 'type', 'textarea', 'label', 'Challenges'),
    jsonb_build_object('name', 'next_week_priorities', 'type', 'textarea', 'label', 'Next Week Priorities', 'required', true),
    jsonb_build_object('name', 'documents', 'type', 'file', 'label', 'Attach Documents', 'multiple', true, 'accept', 'application/pdf,image/*,.doc,.docx,.xls,.xlsx')
  )),
  true
);

-- Development (includes moved forms from Partnership + weekly report)
SELECT upsert_form_template(
  'development'::public.module_type,
  'Grant research update',
  'Document grant opportunity research findings',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('name', 'funder_name', 'type', 'text', 'label', 'Funder Name', 'required', true),
    jsonb_build_object('name', 'opportunity_name', 'type', 'text', 'label', 'Opportunity/Program Name', 'required', true),
    jsonb_build_object('name', 'amount_range', 'type', 'text', 'label', 'Award Amount Range'),
    jsonb_build_object('name', 'deadline', 'type', 'date', 'label', 'Application Deadline'),
    jsonb_build_object('name', 'fit_score', 'type', 'select', 'label', 'Fit Score', 'options', jsonb_build_array('Low', 'Medium', 'High')),
    jsonb_build_object('name', 'research_notes', 'type', 'textarea', 'label', 'Research Notes', 'required', true),
    jsonb_build_object('name', 'documents', 'type', 'file', 'label', 'Attach Documents', 'multiple', true, 'accept', 'application/pdf,image/*,.doc,.docx,.xls,.xlsx')
  )),
  true
);

SELECT upsert_form_template(
  'development'::public.module_type,
  'LOI/proposal submission packet',
  'Submit letter of intent or grant proposal for review',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('name', 'opportunity_name', 'type', 'text', 'label', 'Opportunity Name', 'required', true),
    jsonb_build_object('name', 'submission_type', 'type', 'select', 'label', 'Submission Type', 'options', jsonb_build_array('Letter of Intent', 'Full Proposal', 'Concept Paper'), 'required', true),
    jsonb_build_object('name', 'deadline', 'type', 'date', 'label', 'Submission Deadline', 'required', true),
    jsonb_build_object('name', 'requested_amount', 'type', 'number', 'label', 'Requested Amount ($)'),
    jsonb_build_object('name', 'project_summary', 'type', 'textarea', 'label', 'Project Summary', 'required', true),
    jsonb_build_object('name', 'attachments_uploaded', 'type', 'checkbox', 'label', 'All Required Attachments Uploaded'),
    jsonb_build_object('name', 'documents', 'type', 'file', 'label', 'Attach Documents', 'multiple', true, 'accept', 'application/pdf,image/*,.doc,.docx,.xls,.xlsx')
  )),
  true
);

SELECT upsert_form_template(
  'development'::public.module_type,
  'Post-award reporting submission',
  'Submit required post-award reports',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('name', 'grant_name', 'type', 'text', 'label', 'Grant Name', 'required', true),
    jsonb_build_object('name', 'report_type', 'type', 'select', 'label', 'Report Type', 'options', jsonb_build_array('Progress Report', 'Financial Report', 'Final Report', 'Other'), 'required', true),
    jsonb_build_object('name', 'reporting_period', 'type', 'text', 'label', 'Reporting Period', 'required', true),
    jsonb_build_object('name', 'due_date', 'type', 'date', 'label', 'Due Date', 'required', true),
    jsonb_build_object('name', 'activities_summary', 'type', 'textarea', 'label', 'Activities Summary', 'required', true),
    jsonb_build_object('name', 'budget_status', 'type', 'textarea', 'label', 'Budget Status'),
    jsonb_build_object('name', 'documents', 'type', 'file', 'label', 'Attach Documents', 'multiple', true, 'accept', 'application/pdf,image/*,.doc,.docx,.xls,.xlsx')
  )),
  true
);

SELECT upsert_form_template(
  'development'::public.module_type,
  'Partnership intake',
  'Intake form for new partnership opportunities',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('name', 'partner_name', 'type', 'text', 'label', 'Partner Organization Name', 'required', true),
    jsonb_build_object('name', 'partner_type', 'type', 'select', 'label', 'Partner Type', 'options', jsonb_build_array('Corporate', 'Foundation', 'Government', 'NGO', 'Academic', 'Other'), 'required', true),
    jsonb_build_object('name', 'contact_name', 'type', 'text', 'label', 'Primary Contact Name', 'required', true),
    jsonb_build_object('name', 'contact_email', 'type', 'email', 'label', 'Contact Email', 'required', true),
    jsonb_build_object('name', 'partnership_scope', 'type', 'textarea', 'label', 'Partnership Scope', 'required', true),
    jsonb_build_object('name', 'potential_value', 'type', 'textarea', 'label', 'Potential Value'),
    jsonb_build_object('name', 'documents', 'type', 'file', 'label', 'Attach Documents', 'multiple', true, 'accept', 'application/pdf,image/*,.doc,.docx,.xls,.xlsx')
  )),
  true
);

SELECT upsert_form_template(
  'development'::public.module_type,
  'Meeting notes/follow-up',
  'Document partnership meeting notes and follow-up actions',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('name', 'partner_name', 'type', 'text', 'label', 'Partner Name', 'required', true),
    jsonb_build_object('name', 'meeting_date', 'type', 'date', 'label', 'Meeting Date', 'required', true),
    jsonb_build_object('name', 'attendees', 'type', 'textarea', 'label', 'Attendees', 'required', true),
    jsonb_build_object('name', 'meeting_summary', 'type', 'textarea', 'label', 'Meeting Summary', 'required', true),
    jsonb_build_object('name', 'key_decisions', 'type', 'textarea', 'label', 'Key Decisions'),
    jsonb_build_object('name', 'action_items', 'type', 'textarea', 'label', 'Action Items', 'required', true),
    jsonb_build_object('name', 'next_steps', 'type', 'textarea', 'label', 'Next Steps'),
    jsonb_build_object('name', 'documents', 'type', 'file', 'label', 'Attach Documents', 'multiple', true, 'accept', 'application/pdf,image/*,.doc,.docx,.xls,.xlsx')
  )),
  true
);

SELECT upsert_form_template(
  'development'::public.module_type,
  'MOU/contract request',
  'Request creation or review of MOU or partnership contract',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('name', 'partner_name', 'type', 'text', 'label', 'Partner Name', 'required', true),
    jsonb_build_object('name', 'document_type', 'type', 'select', 'label', 'Document Type', 'options', jsonb_build_array('MOU', 'Partnership Agreement', 'Contract', 'Other'), 'required', true),
    jsonb_build_object('name', 'purpose', 'type', 'textarea', 'label', 'Purpose', 'required', true),
    jsonb_build_object('name', 'key_terms', 'type', 'textarea', 'label', 'Key Terms'),
    jsonb_build_object('name', 'urgency', 'type', 'select', 'label', 'Urgency', 'options', jsonb_build_array('Low', 'Medium', 'High'), 'required', true),
    jsonb_build_object('name', 'legal_review_required', 'type', 'checkbox', 'label', 'Legal Review Required'),
    jsonb_build_object('name', 'documents', 'type', 'file', 'label', 'Attach Documents', 'multiple', true, 'accept', 'application/pdf,image/*,.doc,.docx,.xls,.xlsx')
  )),
  true
);

SELECT upsert_form_template(
  'development'::public.module_type,
  'Director to VP Weekly Report',
  'Weekly report from Director to VP',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('name', 'week_ending', 'type', 'date', 'label', 'Week Ending', 'required', true),
    jsonb_build_object('name', 'key_highlights', 'type', 'textarea', 'label', 'Key Highlights', 'required', true),
    jsonb_build_object('name', 'completed_objectives', 'type', 'textarea', 'label', 'Completed Objectives', 'required', true),
    jsonb_build_object('name', 'challenges', 'type', 'textarea', 'label', 'Challenges'),
    jsonb_build_object('name', 'next_week_priorities', 'type', 'textarea', 'label', 'Next Week Priorities', 'required', true),
    jsonb_build_object('name', 'documents', 'type', 'file', 'label', 'Attach Documents', 'multiple', true, 'accept', 'application/pdf,image/*,.doc,.docx,.xls,.xlsx')
  )),
  true
);

-- Marketing (1 form + weekly report)
SELECT upsert_form_template(
  'marketing'::public.module_type,
  'Marketing request intake',
  'Request marketing support for campaigns or assets',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('name', 'request_type', 'type', 'select', 'label', 'Request Type', 'options', jsonb_build_array('Flyer/Poster', 'Social Media', 'Email Campaign', 'Website Update', 'Video', 'Other'), 'required', true),
    jsonb_build_object('name', 'description', 'type', 'textarea', 'label', 'Description', 'required', true),
    jsonb_build_object('name', 'target_audience', 'type', 'text', 'label', 'Target Audience'),
    jsonb_build_object('name', 'due_date', 'type', 'date', 'label', 'Needed By'),
    jsonb_build_object('name', 'brand_guidelines', 'type', 'checkbox', 'label', 'Follow HPG brand guidelines'),
    jsonb_build_object('name', 'documents', 'type', 'file', 'label', 'Attach Documents', 'multiple', true, 'accept', 'application/pdf,image/*,.doc,.docx,.xls,.xlsx')
  )),
  true
);

SELECT upsert_form_template(
  'marketing'::public.module_type,
  'Director to VP Weekly Report',
  'Weekly report from Director to VP',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('name', 'week_ending', 'type', 'date', 'label', 'Week Ending', 'required', true),
    jsonb_build_object('name', 'key_highlights', 'type', 'textarea', 'label', 'Key Highlights', 'required', true),
    jsonb_build_object('name', 'completed_objectives', 'type', 'textarea', 'label', 'Completed Objectives', 'required', true),
    jsonb_build_object('name', 'challenges', 'type', 'textarea', 'label', 'Challenges'),
    jsonb_build_object('name', 'next_week_priorities', 'type', 'textarea', 'label', 'Next Week Priorities', 'required', true),
    jsonb_build_object('name', 'documents', 'type', 'file', 'label', 'Attach Documents', 'multiple', true, 'accept', 'application/pdf,image/*,.doc,.docx,.xls,.xlsx')
  )),
  true
);

-- Communications (3 forms + weekly report)
SELECT upsert_form_template(
  'communications'::public.module_type,
  'Press release request',
  'Request creation and distribution of a press release',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('name', 'title', 'type', 'text', 'label', 'Press Release Title', 'required', true),
    jsonb_build_object('name', 'event_date', 'type', 'date', 'label', 'Event/Announcement Date'),
    jsonb_build_object('name', 'key_points', 'type', 'textarea', 'label', 'Key Points', 'required', true),
    jsonb_build_object('name', 'target_media', 'type', 'textarea', 'label', 'Target Media Outlets'),
    jsonb_build_object('name', 'distribution_date', 'type', 'date', 'label', 'Desired Distribution Date'),
    jsonb_build_object('name', 'approvals_obtained', 'type', 'checkbox', 'label', 'All Approvals Obtained'),
    jsonb_build_object('name', 'documents', 'type', 'file', 'label', 'Attach Documents', 'multiple', true, 'accept', 'application/pdf,image/*,.doc,.docx,.xls,.xlsx')
  )),
  true
);

SELECT upsert_form_template(
  'communications'::public.module_type,
  'Newsletter Content Submission',
  'Submit content for newsletter issue',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('name', 'issue_date', 'type', 'date', 'label', 'Issue Date', 'required', true),
    jsonb_build_object('name', 'theme', 'type', 'text', 'label', 'Theme/Topic'),
    jsonb_build_object('name', 'featured_stories', 'type', 'textarea', 'label', 'Featured Stories', 'required', true),
    jsonb_build_object('name', 'upcoming_events', 'type', 'textarea', 'label', 'Upcoming Events'),
    jsonb_build_object('name', 'call_to_action', 'type', 'textarea', 'label', 'Call to Action'),
    jsonb_build_object('name', 'documents', 'type', 'file', 'label', 'Attach Documents', 'multiple', true, 'accept', 'application/pdf,image/*,.doc,.docx,.xls,.xlsx')
  )),
  true
);

SELECT upsert_form_template(
  'communications'::public.module_type,
  'Internal memo request',
  'Request creation and distribution of internal memo',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('name', 'subject', 'type', 'text', 'label', 'Subject', 'required', true),
    jsonb_build_object('name', 'recipients', 'type', 'select', 'label', 'Recipients', 'options', jsonb_build_array('All Staff', 'Management', 'Department Specific', 'Other'), 'required', true),
    jsonb_build_object('name', 'content', 'type', 'textarea', 'label', 'Memo Content', 'required', true),
    jsonb_build_object('name', 'priority', 'type', 'select', 'label', 'Priority', 'options', jsonb_build_array('Normal', 'Urgent')),
    jsonb_build_object('name', 'distribution_date', 'type', 'date', 'label', 'Distribution Date'),
    jsonb_build_object('name', 'documents', 'type', 'file', 'label', 'Attach Documents', 'multiple', true, 'accept', 'application/pdf,image/*,.doc,.docx,.xls,.xlsx')
  )),
  true
);

SELECT upsert_form_template(
  'communications'::public.module_type,
  'Director to VP Weekly Report',
  'Weekly report from Director to VP',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('name', 'week_ending', 'type', 'date', 'label', 'Week Ending', 'required', true),
    jsonb_build_object('name', 'key_highlights', 'type', 'textarea', 'label', 'Key Highlights', 'required', true),
    jsonb_build_object('name', 'completed_objectives', 'type', 'textarea', 'label', 'Completed Objectives', 'required', true),
    jsonb_build_object('name', 'challenges', 'type', 'textarea', 'label', 'Challenges'),
    jsonb_build_object('name', 'next_week_priorities', 'type', 'textarea', 'label', 'Next Week Priorities', 'required', true),
    jsonb_build_object('name', 'documents', 'type', 'file', 'label', 'Attach Documents', 'multiple', true, 'accept', 'application/pdf,image/*,.doc,.docx,.xls,.xlsx')
  )),
  true
);

-- HR (2 forms + weekly report)
SELECT upsert_form_template(
  'hr'::public.module_type,
  'Attendance Form',
  'Submit attendance or time tracking information',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('name', 'employee_name', 'type', 'text', 'label', 'Employee Name', 'required', true),
    jsonb_build_object('name', 'period_start', 'type', 'date', 'label', 'Period Start', 'required', true),
    jsonb_build_object('name', 'period_end', 'type', 'date', 'label', 'Period End', 'required', true),
    jsonb_build_object('name', 'hours_worked', 'type', 'number', 'label', 'Hours Worked'),
    jsonb_build_object('name', 'leave_taken', 'type', 'select', 'label', 'Leave Taken', 'options', jsonb_build_array('None', 'Sick Leave', 'Vacation', 'Personal', 'Other')),
    jsonb_build_object('name', 'notes', 'type', 'textarea', 'label', 'Notes'),
    jsonb_build_object('name', 'documents', 'type', 'file', 'label', 'Attach Documents', 'multiple', true, 'accept', 'application/pdf,image/*,.doc,.docx,.xls,.xlsx')
  )),
  true
);

SELECT upsert_form_template(
  'hr'::public.module_type,
  'Interview scorecard',
  'Record interview feedback and scoring',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('name', 'candidate_name', 'type', 'text', 'label', 'Candidate Name', 'required', true),
    jsonb_build_object('name', 'position', 'type', 'text', 'label', 'Position', 'required', true),
    jsonb_build_object('name', 'interview_date', 'type', 'date', 'label', 'Interview Date', 'required', true),
    jsonb_build_object('name', 'overall_score', 'type', 'select', 'label', 'Overall Score', 'options', jsonb_build_array('1 - Poor', '2 - Fair', '3 - Good', '4 - Very Good', '5 - Excellent'), 'required', true),
    jsonb_build_object('name', 'strengths', 'type', 'textarea', 'label', 'Strengths', 'required', true),
    jsonb_build_object('name', 'concerns', 'type', 'textarea', 'label', 'Concerns'),
    jsonb_build_object('name', 'recommendation', 'type', 'select', 'label', 'Recommendation', 'options', jsonb_build_array('Strong Hire', 'Hire', 'Maybe', 'Do Not Hire'), 'required', true),
    jsonb_build_object('name', 'documents', 'type', 'file', 'label', 'Attach Documents', 'multiple', true, 'accept', 'application/pdf,image/*,.doc,.docx,.xls,.xlsx')
  )),
  true
);

SELECT upsert_form_template(
  'hr'::public.module_type,
  'Department Staffing Request',
  'Request new staff position or department staffing needs',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('name', 'department', 'type', 'text', 'label', 'Department', 'required', true),
    jsonb_build_object('name', 'position_title', 'type', 'text', 'label', 'Position Title', 'required', true),
    jsonb_build_object('name', 'request_type', 'type', 'select', 'label', 'Request Type', 'options', jsonb_build_array('New Position', 'Replacement', 'Temporary', 'Contract', 'Intern'), 'required', true),
    jsonb_build_object('name', 'justification', 'type', 'textarea', 'label', 'Justification', 'required', true),
    jsonb_build_object('name', 'budget_impact', 'type', 'number', 'label', 'Budget Impact ($)'),
    jsonb_build_object('name', 'urgency', 'type', 'select', 'label', 'Urgency', 'options', jsonb_build_array('Low', 'Medium', 'High'), 'required', true),
    jsonb_build_object('name', 'target_start_date', 'type', 'date', 'label', 'Target Start Date'),
    jsonb_build_object('name', 'documents', 'type', 'file', 'label', 'Attach Documents', 'multiple', true, 'accept', 'application/pdf,image/*,.doc,.docx,.xls,.xlsx')
  )),
  true
);

SELECT upsert_form_template(
  'hr'::public.module_type,
  'Director to VP Weekly Report',
  'Weekly report from Director to VP',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('name', 'week_ending', 'type', 'date', 'label', 'Week Ending', 'required', true),
    jsonb_build_object('name', 'key_highlights', 'type', 'textarea', 'label', 'Key Highlights', 'required', true),
    jsonb_build_object('name', 'completed_objectives', 'type', 'textarea', 'label', 'Completed Objectives', 'required', true),
    jsonb_build_object('name', 'challenges', 'type', 'textarea', 'label', 'Challenges'),
    jsonb_build_object('name', 'next_week_priorities', 'type', 'textarea', 'label', 'Next Week Priorities', 'required', true),
    jsonb_build_object('name', 'documents', 'type', 'file', 'label', 'Attach Documents', 'multiple', true, 'accept', 'application/pdf,image/*,.doc,.docx,.xls,.xlsx')
  )),
  true
);

-- IT (2 forms + weekly report)
SELECT upsert_form_template(
  'it'::public.module_type,
  'Support ticket',
  'Submit IT support request or report an issue',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('name', 'issue_type', 'type', 'select', 'label', 'Issue Type', 'options', jsonb_build_array('Hardware', 'Software', 'Network', 'Account Access', 'Other'), 'required', true),
    jsonb_build_object('name', 'description', 'type', 'textarea', 'label', 'Description', 'required', true),
    jsonb_build_object('name', 'severity', 'type', 'select', 'label', 'Severity', 'options', jsonb_build_array('Low', 'Medium', 'High', 'Critical'), 'required', true),
    jsonb_build_object('name', 'affected_users', 'type', 'text', 'label', 'Affected Users'),
    jsonb_build_object('name', 'steps_to_reproduce', 'type', 'textarea', 'label', 'Steps to Reproduce'),
    jsonb_build_object('name', 'documents', 'type', 'file', 'label', 'Attach Documents', 'multiple', true, 'accept', 'application/pdf,image/*,.doc,.docx,.xls,.xlsx')
  )),
  true
);

SELECT upsert_form_template(
  'it'::public.module_type,
  'Research Request',
  'Request research on technology solutions or tools',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('name', 'research_topic', 'type', 'text', 'label', 'Research Topic', 'required', true),
    jsonb_build_object('name', 'purpose', 'type', 'textarea', 'label', 'Purpose/Use Case', 'required', true),
    jsonb_build_object('name', 'urgency', 'type', 'select', 'label', 'Urgency', 'options', jsonb_build_array('Low', 'Medium', 'High'), 'required', true),
    jsonb_build_object('name', 'deadline', 'type', 'date', 'label', 'Deadline'),
    jsonb_build_object('name', 'requirements', 'type', 'textarea', 'label', 'Specific Requirements'),
    jsonb_build_object('name', 'documents', 'type', 'file', 'label', 'Attach Documents', 'multiple', true, 'accept', 'application/pdf,image/*,.doc,.docx,.xls,.xlsx')
  )),
  true
);

SELECT upsert_form_template(
  'it'::public.module_type,
  'Director to VP Weekly Report',
  'Weekly report from Director to VP',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('name', 'week_ending', 'type', 'date', 'label', 'Week Ending', 'required', true),
    jsonb_build_object('name', 'key_highlights', 'type', 'textarea', 'label', 'Key Highlights', 'required', true),
    jsonb_build_object('name', 'completed_objectives', 'type', 'textarea', 'label', 'Completed Objectives', 'required', true),
    jsonb_build_object('name', 'challenges', 'type', 'textarea', 'label', 'Challenges'),
    jsonb_build_object('name', 'next_week_priorities', 'type', 'textarea', 'label', 'Next Week Priorities', 'required', true),
    jsonb_build_object('name', 'documents', 'type', 'file', 'label', 'Attach Documents', 'multiple', true, 'accept', 'application/pdf,image/*,.doc,.docx,.xls,.xlsx')
  )),
  true
);

-- Finance (3 forms + weekly report)
SELECT upsert_form_template(
  'finance'::public.module_type,
  'Payment processing request',
  'Request payment processing for approved expenses or invoices',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('name', 'payee_name', 'type', 'text', 'label', 'Payee Name', 'required', true),
    jsonb_build_object('name', 'amount', 'type', 'number', 'label', 'Amount ($)', 'required', true),
    jsonb_build_object('name', 'payment_type', 'type', 'select', 'label', 'Payment Type', 'options', jsonb_build_array('Expense Reimbursement', 'Vendor Invoice', 'Grant Payment', 'Other'), 'required', true),
    jsonb_build_object('name', 'due_date', 'type', 'date', 'label', 'Due Date'),
    jsonb_build_object('name', 'account_code', 'type', 'text', 'label', 'Account Code'),
    jsonb_build_object('name', 'approval_attached', 'type', 'checkbox', 'label', 'Approval Documentation Attached'),
    jsonb_build_object('name', 'documents', 'type', 'file', 'label', 'Attach Documents', 'multiple', true, 'accept', 'application/pdf,image/*,.doc,.docx,.xls,.xlsx')
  )),
  true
);

SELECT upsert_form_template(
  'finance'::public.module_type,
  'Budget adjustment request',
  'Request budget adjustment or transfer',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('name', 'from_account', 'type', 'text', 'label', 'From Account', 'required', true),
    jsonb_build_object('name', 'to_account', 'type', 'text', 'label', 'To Account', 'required', true),
    jsonb_build_object('name', 'amount', 'type', 'number', 'label', 'Amount ($)', 'required', true),
    jsonb_build_object('name', 'justification', 'type', 'textarea', 'label', 'Justification', 'required', true),
    jsonb_build_object('name', 'approval_required', 'type', 'select', 'label', 'Approval Level', 'options', jsonb_build_array('Department Head', 'VP', 'CEO')),
    jsonb_build_object('name', 'documents', 'type', 'file', 'label', 'Attach Documents', 'multiple', true, 'accept', 'application/pdf,image/*,.doc,.docx,.xls,.xlsx')
  )),
  true
);

SELECT upsert_form_template(
  'finance'::public.module_type,
  'Receipt submission',
  'For bookkeeping',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('name', 'expense_date', 'type', 'date', 'label', 'Expense Date', 'required', true),
    jsonb_build_object('name', 'vendor', 'type', 'text', 'label', 'Vendor', 'required', true),
    jsonb_build_object('name', 'amount', 'type', 'number', 'label', 'Amount ($)', 'required', true),
    jsonb_build_object('name', 'category', 'type', 'select', 'label', 'Category', 'options', jsonb_build_array('Travel', 'Supplies', 'Equipment', 'Services', 'Meals', 'Other'), 'required', true),
    jsonb_build_object('name', 'description', 'type', 'textarea', 'label', 'Description'),
    jsonb_build_object('name', 'receipt_uploaded', 'type', 'checkbox', 'label', 'Receipt Uploaded', 'required', true),
    jsonb_build_object('name', 'documents', 'type', 'file', 'label', 'Attach Documents', 'multiple', true, 'accept', 'application/pdf,image/*,.doc,.docx,.xls,.xlsx')
  )),
  true
);

SELECT upsert_form_template(
  'finance'::public.module_type,
  'Director to VP Weekly Report',
  'Weekly report from Director to VP',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('name', 'week_ending', 'type', 'date', 'label', 'Week Ending', 'required', true),
    jsonb_build_object('name', 'key_highlights', 'type', 'textarea', 'label', 'Key Highlights', 'required', true),
    jsonb_build_object('name', 'completed_objectives', 'type', 'textarea', 'label', 'Completed Objectives', 'required', true),
    jsonb_build_object('name', 'challenges', 'type', 'textarea', 'label', 'Challenges'),
    jsonb_build_object('name', 'next_week_priorities', 'type', 'textarea', 'label', 'Next Week Priorities', 'required', true),
    jsonb_build_object('name', 'documents', 'type', 'file', 'label', 'Attach Documents', 'multiple', true, 'accept', 'application/pdf,image/*,.doc,.docx,.xls,.xlsx')
  )),
  true
);

-- Legal/Compliance (1 form + weekly report)
SELECT upsert_form_template(
  'legal'::public.module_type,
  'Compliance filing proof',
  'Submit evidence of regulatory filing completion',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('name', 'filing_type', 'type', 'select', 'label', 'Filing Type', 'options', jsonb_build_array('Annual Report', 'Tax Filing', 'State Registration', 'Federal Registration', 'Other'), 'required', true),
    jsonb_build_object('name', 'filing_date', 'type', 'date', 'label', 'Filing Date', 'required', true),
    jsonb_build_object('name', 'jurisdiction', 'type', 'text', 'label', 'Jurisdiction', 'required', true),
    jsonb_build_object('name', 'confirmation_number', 'type', 'text', 'label', 'Confirmation/Reference Number'),
    jsonb_build_object('name', 'documentation_attached', 'type', 'checkbox', 'label', 'Documentation Attached', 'required', true),
    jsonb_build_object('name', 'next_due_date', 'type', 'date', 'label', 'Next Due Date'),
    jsonb_build_object('name', 'documents', 'type', 'file', 'label', 'Attach Documents', 'multiple', true, 'accept', 'application/pdf,image/*,.doc,.docx,.xls,.xlsx')
  )),
  true
);

SELECT upsert_form_template(
  'legal'::public.module_type,
  'Director to VP Weekly Report',
  'Weekly report from Director to VP',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('name', 'week_ending', 'type', 'date', 'label', 'Week Ending', 'required', true),
    jsonb_build_object('name', 'key_highlights', 'type', 'textarea', 'label', 'Key Highlights', 'required', true),
    jsonb_build_object('name', 'completed_objectives', 'type', 'textarea', 'label', 'Completed Objectives', 'required', true),
    jsonb_build_object('name', 'challenges', 'type', 'textarea', 'label', 'Challenges'),
    jsonb_build_object('name', 'next_week_priorities', 'type', 'textarea', 'label', 'Next Week Priorities', 'required', true),
    jsonb_build_object('name', 'documents', 'type', 'file', 'label', 'Attach Documents', 'multiple', true, 'accept', 'application/pdf,image/*,.doc,.docx,.xls,.xlsx')
  )),
  true
);

-- Step 10: Verification Queries
-- (a) Total count
SELECT 
  COUNT(*) as total_active_forms
FROM public.form_templates
WHERE is_active = true;

-- (b) Count per module
SELECT 
  module,
  COUNT(*) as form_count
FROM public.form_templates
WHERE is_active = true
GROUP BY module
ORDER BY module;

-- (c) List of module + name
SELECT 
  module,
  name
FROM public.form_templates
WHERE is_active = true
ORDER BY module, name;
