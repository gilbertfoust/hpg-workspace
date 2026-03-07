-- Ensure RLS policies allow authenticated internal users to create work items from form submissions
-- The existing policy "Users can create own work items" requires created_by_user_id = auth.uid()
-- This is already satisfied by our implementation, but we verify the policy exists

-- Verify the policy exists (it should from previous migrations)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'work_items'
      AND policyname = 'Users can create own work items'
  ) THEN
    -- Create the policy if it doesn't exist
    CREATE POLICY "Users can create own work items"
      ON public.work_items
      FOR INSERT TO authenticated
      WITH CHECK (created_by_user_id = auth.uid());
  END IF;
END $$;

-- Also ensure internal users (staff_member role) can create work items
-- Check if a policy exists that allows staff to create work items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'work_items'
      AND policyname = 'Internal users can create work items'
  ) THEN
    -- Create additional policy for internal users
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
  END IF;
END $$;

-- Verification query
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
