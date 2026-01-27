-- Test Data Seed Script for Queue + Drawer Testing
-- Creates sample work items, NGOs, and users for testing My Queue, Dept Queue, and WorkItemDrawer
-- Run this AFTER migrations are applied

-- Step 1: Create test users (if they don't exist)
-- Note: These are placeholder user IDs - replace with actual auth.users IDs from your Supabase instance
-- Or create test users via Supabase Auth UI first, then update these IDs

-- Step 2: Create test NGO (if needed)
INSERT INTO public.ngos (
  id,
  legal_name,
  common_name,
  status,
  fiscal_type,
  country,
  city
)
VALUES (
  gen_random_uuid(),
  'Test NGO Organization',
  'Test NGO',
  'Active'::public.ngo_status,
  'model_a'::public.fiscal_type,
  'United States',
  'Test City'
)
ON CONFLICT DO NOTHING;

-- Get test NGO ID for use in work items
DO $$
DECLARE
  test_ngo_id UUID;
  test_user_id UUID;
  test_dept_id UUID;
BEGIN
  -- Get or create test NGO
  SELECT id INTO test_ngo_id
  FROM public.ngos
  WHERE common_name = 'Test NGO'
  LIMIT 1;

  IF test_ngo_id IS NULL THEN
    INSERT INTO public.ngos (
      legal_name,
      common_name,
      status,
      fiscal_type,
      country,
      city
    )
    VALUES (
      'Test NGO Organization',
      'Test NGO',
      'Active'::public.ngo_status,
      'model_a'::public.fiscal_type,
      'United States',
      'Test City'
    )
    RETURNING id INTO test_ngo_id;
  END IF;

  -- Get a test user (first authenticated user, or create a test profile)
  SELECT id INTO test_user_id
  FROM auth.users
  LIMIT 1;

  -- Get a test department
  SELECT id INTO test_dept_id
  FROM public.org_units
  LIMIT 1;

  -- Create test work items for My Queue (assigned to test_user_id)
  IF test_user_id IS NOT NULL THEN
    INSERT INTO public.work_items (
      title,
      description,
      status,
      priority,
      owner_user_id,
      ngo_id,
      department_id,
      module,
      due_date,
      evidence_required,
      evidence_status,
      type
    )
    VALUES
      (
        'Test Work Item - My Queue 1',
        'This work item is assigned to the current user for testing My Queue',
        'in_progress'::public.work_item_status,
        'high'::public.priority,
        test_user_id,
        test_ngo_id,
        test_dept_id,
        'ngo_coordination'::public.module_type,
        CURRENT_DATE + INTERVAL '3 days',
        true,
        'missing',
        'task'
      ),
      (
        'Test Work Item - My Queue 2',
        'Another work item assigned to the current user',
        'not_started'::public.work_item_status,
        'medium'::public.priority,
        test_user_id,
        test_ngo_id,
        test_dept_id,
        'program'::public.module_type,
        CURRENT_DATE + INTERVAL '7 days',
        false,
        NULL,
        'follow_up'
      ),
      (
        'Test Work Item - Overdue',
        'This work item is overdue for testing dashboard metrics',
        'in_progress'::public.work_item_status,
        'urgent'::public.priority,
        test_user_id,
        test_ngo_id,
        test_dept_id,
        'development'::public.module_type,
        CURRENT_DATE - INTERVAL '5 days', -- Overdue
        true,
        'missing',
        'deliverable'
      )
    ON CONFLICT DO NOTHING;
  END IF;

  -- Create test work items for Department Queue (assigned to test_dept_id)
  IF test_dept_id IS NOT NULL THEN
    INSERT INTO public.work_items (
      title,
      description,
      status,
      priority,
      department_id,
      ngo_id,
      module,
      due_date,
      evidence_required,
      evidence_status,
      type
    )
    VALUES
      (
        'Test Work Item - Dept Queue 1',
        'This work item belongs to a department for testing Dept Queue',
        'waiting_on_ngo'::public.work_item_status,
        'medium'::public.priority,
        test_dept_id,
        test_ngo_id,
        'operations'::public.module_type,
        CURRENT_DATE + INTERVAL '10 days',
        false,
        NULL,
        'task'
      ),
      (
        'Test Work Item - Dept Queue 2',
        'Another department work item',
        'submitted'::public.work_item_status,
        'low'::public.priority,
        test_dept_id,
        test_ngo_id,
        'finance'::public.module_type,
        CURRENT_DATE + INTERVAL '14 days',
        true,
        'uploaded',
        'review'
      )
    ON CONFLICT DO NOTHING;
  END IF;

  -- Create work item with approval workflow
  IF test_user_id IS NOT NULL AND test_dept_id IS NOT NULL THEN
    INSERT INTO public.work_items (
      title,
      description,
      status,
      priority,
      owner_user_id,
      approver_user_id,
      department_id,
      ngo_id,
      module,
      due_date,
      approval_required,
      type
    )
    VALUES (
      'Test Work Item - Approval Required',
      'This work item requires approval for testing approval workflow in drawer',
      'under_review'::public.work_item_status,
      'high'::public.priority,
      test_user_id,
      test_user_id, -- Same user as approver for testing
      test_dept_id,
      test_ngo_id,
      'legal'::public.module_type,
      CURRENT_DATE + INTERVAL '5 days',
      true,
      'approval'
    )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Verification queries
SELECT 
  'Work Items Created' as check_type,
  COUNT(*) as count
FROM public.work_items
WHERE title LIKE 'Test Work Item%';

SELECT 
  'Work Items by Status' as check_type,
  status,
  COUNT(*) as count
FROM public.work_items
WHERE title LIKE 'Test Work Item%'
GROUP BY status
ORDER BY status;

SELECT 
  'Work Items by Owner' as check_type,
  owner_user_id IS NOT NULL as has_owner,
  COUNT(*) as count
FROM public.work_items
WHERE title LIKE 'Test Work Item%'
GROUP BY owner_user_id IS NOT NULL;
