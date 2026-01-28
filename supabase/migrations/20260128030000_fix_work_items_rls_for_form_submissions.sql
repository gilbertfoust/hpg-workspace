-- Fix RLS policies to allow authenticated users to create work items from form submissions
-- The existing policy "Management can create work items" is too restrictive
-- We need to ensure regular authenticated users can create work items when created_by_user_id = auth.uid()

-- Drop the overly restrictive policy if it exists
DROP POLICY IF EXISTS "Management can create work items" ON public.work_items;

-- Create a policy that allows authenticated users to create work items they own
-- This is required for form submissions to create work items
CREATE POLICY "Authenticated users can create own work items"
  ON public.work_items
  FOR INSERT TO authenticated
  WITH CHECK (created_by_user_id = auth.uid());

-- Also ensure internal users (staff_member, department_lead, etc.) can create work items
-- This is a backup policy for users with internal roles
CREATE POLICY "Internal users can create work items"
  ON public.work_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = p.id
            AND ur.role IN ('staff_member', 'department_lead', 'ngo_coordinator', 'admin_pm', 'super_admin')
        )
    )
    AND created_by_user_id = auth.uid()
  );

-- Verification query to show all INSERT policies on work_items
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'work_items'
  AND cmd = 'INSERT'
ORDER BY policyname;
