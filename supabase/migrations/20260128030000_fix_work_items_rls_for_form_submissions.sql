-- Fix RLS policies to allow authenticated users to create work items from form submissions
-- The existing policy "Management can create work items" is too restrictive
-- We need to ensure regular authenticated users can create work items when created_by_user_id = auth.uid()

-- Drop the overly restrictive policy if it exists
DROP POLICY IF EXISTS "Management can create work items" ON public.work_items;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Authenticated users can create own work items" ON public.work_items;
DROP POLICY IF EXISTS "Internal users can create work items" ON public.work_items;
DROP POLICY IF EXISTS "Users can create own work items" ON public.work_items;

-- Create a policy that allows authenticated users to create work items they own
-- This is required for form submissions to create work items
CREATE POLICY "Authenticated users can create own work items"
  ON public.work_items
  FOR INSERT TO authenticated
  WITH CHECK (created_by_user_id = auth.uid());

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
