-- Restore migration history parity for remote-applied dashboard compatibility columns.
-- Idempotent compatibility columns for dashboard and NGO views.

ALTER TABLE public.ngos
  ADD COLUMN IF NOT EXISTS confluence_url text,
  ADD COLUMN IF NOT EXISTS region text;

ALTER TABLE public.form_submissions
  ADD COLUMN IF NOT EXISTS routed_module public.module_type,
  ADD COLUMN IF NOT EXISTS status text;

ALTER TABLE public.work_items
  ADD COLUMN IF NOT EXISTS checklist_json jsonb DEFAULT NULL;
