-- Migration: Add HR Complaint Form
-- Adds a form template for submitting HR complaints

-- Ensure the upsert function exists (from previous migrations)
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

-- Add HR Complaint Form
SELECT upsert_form_template(
  'hr'::public.module_type,
  'HR Complaint',
  'Submit a formal complaint or concern to Human Resources',
  jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('name', 'complainant_name', 'type', 'text', 'label', 'Your Name', 'required', true),
    jsonb_build_object('name', 'complainant_email', 'type', 'email', 'label', 'Your Email', 'required', true),
    jsonb_build_object('name', 'complainant_department', 'type', 'text', 'label', 'Your Department'),
    jsonb_build_object('name', 'complaint_type', 'type', 'select', 'label', 'Complaint Type', 'options', jsonb_build_array('Harassment', 'Discrimination', 'Workplace Safety', 'Policy Violation', 'Unfair Treatment', 'Retaliation', 'Other'), 'required', true),
    jsonb_build_object('name', 'incident_date', 'type', 'date', 'label', 'Date of Incident', 'required', true),
    jsonb_build_object('name', 'involved_parties', 'type', 'textarea', 'label', 'Involved Parties', 'required', true, 'placeholder', 'Please list the names and roles of all parties involved'),
    jsonb_build_object('name', 'complaint_description', 'type', 'textarea', 'label', 'Complaint Description', 'required', true, 'placeholder', 'Please provide a detailed description of the incident or concern'),
    jsonb_build_object('name', 'witnesses', 'type', 'textarea', 'label', 'Witnesses', 'placeholder', 'Please list any witnesses to the incident (if applicable)'),
    jsonb_build_object('name', 'previous_reports', 'type', 'textarea', 'label', 'Previous Reports', 'placeholder', 'Have you reported this issue before? If yes, please provide details'),
    jsonb_build_object('name', 'desired_outcome', 'type', 'textarea', 'label', 'Desired Outcome', 'placeholder', 'What resolution or outcome are you seeking?'),
    jsonb_build_object('name', 'confidentiality_preference', 'type', 'select', 'label', 'Confidentiality Preference', 'options', jsonb_build_array('Keep as confidential as possible', 'Allow disclosure to necessary parties', 'No preference'), 'required', true),
    jsonb_build_object('name', 'documents', 'type', 'file', 'label', 'Attach Supporting Documents', 'multiple', true, 'accept', 'application/pdf,image/*,.doc,.docx,.xls,.xlsx', 'help_text', 'You may attach any relevant documents, emails, or evidence related to this complaint')
  )),
  true
);
