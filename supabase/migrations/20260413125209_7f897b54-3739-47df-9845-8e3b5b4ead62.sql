
-- Part 1a: Add checklist_json to work_items
ALTER TABLE public.work_items ADD COLUMN IF NOT EXISTS checklist_json jsonb DEFAULT NULL;

-- Part 1b: Expand applicants table with Xenia template fields
ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS title_considered text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS manager text,
  ADD COLUMN IF NOT EXISTS is_otp boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS hours_committing text,
  ADD COLUMN IF NOT EXISTS time_commitment text,
  ADD COLUMN IF NOT EXISTS availability_schedule text,
  ADD COLUMN IF NOT EXISTS best_interview_times text,
  ADD COLUMN IF NOT EXISTS potential_start_date date,
  ADD COLUMN IF NOT EXISTS personal_email text,
  ADD COLUMN IF NOT EXISTS location_timezone text,
  ADD COLUMN IF NOT EXISTS departmental_assessment text;

-- Part 1c: Update validate_applicant_stage() to support all 14 Trello stages + legacy stages
CREATE OR REPLACE FUNCTION public.validate_applicant_stage()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.stage NOT IN (
    -- Legacy stages (backward compat)
    'Applied', 'Screening', 'Interviewing', 'Offer', 'Hired', 'Rejected',
    -- New Trello ATS stages
    'Newly Received', 'HR Screening', 'Dept Head Approval', 'Rejected by Dept',
    'Send Interview Request', 'Interview Request Sent', 'Interview Times Received',
    'Interview Confirmation', 'Interview Scheduled', 'Interview Completed',
    'Dept Decision Made', 'Onboarding Email Sent', 'Materials Received', 'Sent to IT'
  ) THEN
    RAISE EXCEPTION 'Invalid applicant stage: %', NEW.stage;
  END IF;
  RETURN NEW;
END;
$function$;
