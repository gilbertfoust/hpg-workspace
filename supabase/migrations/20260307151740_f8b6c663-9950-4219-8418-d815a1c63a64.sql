
-- Storage bucket RLS policies for all 6 buckets
-- Using DO blocks to avoid errors if policies already exist

DO $$ BEGIN
  CREATE POLICY "auth_upload_ngo_docs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ngo-documents');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "auth_read_ngo_docs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'ngo-documents');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "internal_delete_ngo_docs" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'ngo-documents');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "auth_upload_esign_docs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'esign-documents');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "auth_read_esign_docs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'esign-documents');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "internal_delete_esign_docs" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'esign-documents');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "auth_upload_signed_docs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'esign-signed-documents');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "auth_read_signed_docs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'esign-signed-documents');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "auth_upload_receipts" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ledger-receipts');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "auth_read_receipts" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'ledger-receipts');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "internal_delete_receipts" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'ledger-receipts');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "auth_upload_compliance" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'compliance-packages');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "auth_read_compliance" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'compliance-packages');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "internal_delete_compliance" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'compliance-packages');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "auth_upload_intake" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'intake-documents');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "auth_read_intake" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'intake-documents');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "internal_delete_intake" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'intake-documents');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
