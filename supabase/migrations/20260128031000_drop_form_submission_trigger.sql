-- Drop the trigger that auto-creates work items on form submission insert
-- This trigger is causing errors because it references form_templates.department_id which doesn't exist
-- We handle work item creation in the TypeScript code instead

-- Drop all possible trigger names
DROP TRIGGER IF EXISTS create_work_item_for_submission_trigger ON public.form_submissions;
DROP TRIGGER IF EXISTS trg_create_work_item_on_submission ON public.form_submissions;
DROP TRIGGER IF EXISTS create_work_item_on_submission ON public.form_submissions;

-- Drop the trigger function with CASCADE to remove dependencies
DROP FUNCTION IF EXISTS public.create_work_item_for_submission() CASCADE;

-- Verification: Show remaining triggers on form_submissions
SELECT
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'form_submissions'
  AND event_object_schema = 'public';
