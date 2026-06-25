-- Restore migration history parity for remote-applied NGO status compatibility.
-- This migration is intentionally idempotent so it is safe on databases where the change already exists.

ALTER TABLE public.ngos
  DROP CONSTRAINT IF EXISTS ngos_status_check;

ALTER TABLE public.ngos
  ADD CONSTRAINT ngos_status_check
  CHECK (
    status = ANY (
      ARRAY[
        'Prospect'::text,
        'Onboarding'::text,
        'Active'::text,
        'At-Risk'::text,
        'Offboarding'::text,
        'Closed'::text,
        'prospect'::text,
        'onboarding'::text,
        'active'::text,
        'at_risk'::text,
        'offboarding'::text,
        'closed'::text
      ]
    )
  );
