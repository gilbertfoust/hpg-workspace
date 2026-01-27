-- Ensure form submission file uploads work with existing storage bucket
-- The ngo-documents bucket already exists and has RLS policies
-- Form submissions upload to: form-submissions/{user_id}/{timestamp}_{filename}
-- This migration ensures those paths are accessible

-- Verify bucket exists (should already exist from previous migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'ngo-documents'
  ) THEN
    -- Create bucket if it doesn't exist (shouldn't happen, but safe)
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'ngo-documents',
      'ngo-documents',
      false,
      52428800, -- 50MB limit
      ARRAY[
        'application/pdf', 
        'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/jpeg', 
        'image/png', 
        'image/gif', 
        'image/webp', 
        'text/plain', 
        'text/csv'
      ]
    );
  END IF;
END $$;

-- RLS policies already exist for authenticated users on ngo-documents bucket
-- Form submission uploads use paths like: form-submissions/{user_id}/...
-- These are covered by existing policies:
-- - "Authenticated users can upload documents" (INSERT)
-- - "Authenticated users can view documents" (SELECT)
-- - "Authenticated users can update documents" (UPDATE)
-- - "Authenticated users can delete documents" (DELETE)

-- No additional policies needed - existing policies cover form submission uploads
-- Verification: Check that policies exist
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%documents%'
ORDER BY policyname;
