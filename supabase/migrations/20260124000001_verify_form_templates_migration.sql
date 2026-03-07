-- Verification Script for Form Templates Refactoring Migration
-- Run this AFTER applying 20260124000000_refactor_form_templates.sql
-- Expected results documented in comments

-- 1. Total count of active forms (should be ~50+ after refactoring)
SELECT 
  COUNT(*) as total_active_forms,
  'Expected: ~50+ forms' as note
FROM public.form_templates
WHERE is_active = true;

-- 2. Count per module (verify all departments have forms)
SELECT 
  module,
  COUNT(*) as form_count
FROM public.form_templates
WHERE is_active = true
GROUP BY module
ORDER BY module;

-- 3. Verify all forms have document upload field
SELECT 
  module,
  name,
  CASE 
    WHEN schema_json->'fields' @> '[{"name": "documents"}]'::jsonb 
    THEN '✓ Has documents field'
    ELSE '✗ Missing documents field'
  END as documents_field_status
FROM public.form_templates
WHERE is_active = true
ORDER BY module, name;

-- 4. Verify weekly report forms exist for all departments
SELECT 
  module,
  COUNT(*) as weekly_report_count
FROM public.form_templates
WHERE is_active = true 
  AND name LIKE '%Director to VP%Weekly%Report%'
GROUP BY module
ORDER BY module;

-- 5. Verify no duplicate forms (module + name should be unique)
SELECT 
  module,
  name,
  COUNT(*) as duplicate_count
FROM public.form_templates
WHERE is_active = true
GROUP BY module, name
HAVING COUNT(*) > 1;

-- 6. Verify forms moved correctly (Partnership -> Development)
SELECT 
  module,
  name,
  'Should be in development module' as expected_location
FROM public.form_templates
WHERE is_active = true
  AND name IN ('Partnership intake', 'Meeting notes/follow-up', 'MOU/contract request')
ORDER BY module, name;

-- 7. Verify forms moved correctly (Curriculum -> Program)
SELECT 
  module,
  name,
  'Should be in program module' as expected_location
FROM public.form_templates
WHERE is_active = true
  AND module = 'program'
  AND name LIKE '%curriculum%'
ORDER BY name;

-- 8. Verify deleted forms are gone
SELECT 
  'These forms should NOT exist' as check_type,
  module,
  name
FROM public.form_templates
WHERE (module, name) IN (
  ('ngo_coordination', 'NGO Intake/Update'),
  ('ngo_coordination', 'Document Request'),
  ('marketing', 'Asset request'),
  ('marketing', 'Monthly marketing report'),
  ('hr', 'Access request'),
  ('hr', 'Staffing Request'),
  ('hr', 'Staffing recruitment request'),
  ('hr', 'Offer approval'),
  ('development', 'Opportunity qualification')
);

-- 9. Verify renamed form
SELECT 
  module,
  name,
  'Should be renamed to Newsletter Content Submission' as expected_name
FROM public.form_templates
WHERE module = 'communications'
  AND name LIKE '%Newsletter%'
ORDER BY name;

-- 10. Verify IT Research Request form exists
SELECT 
  module,
  name,
  'Should exist in IT module' as expected_location
FROM public.form_templates
WHERE module = 'it'
  AND name LIKE '%Research%'
ORDER BY name;

-- 11. Summary: Forms by module with document upload coverage
SELECT 
  module,
  COUNT(*) as total_forms,
  COUNT(CASE WHEN schema_json->'fields' @> '[{"name": "documents"}]'::jsonb THEN 1 END) as forms_with_documents,
  COUNT(*) - COUNT(CASE WHEN schema_json->'fields' @> '[{"name": "documents"}]'::jsonb THEN 1 END) as forms_missing_documents
FROM public.form_templates
WHERE is_active = true
GROUP BY module
ORDER BY module;
