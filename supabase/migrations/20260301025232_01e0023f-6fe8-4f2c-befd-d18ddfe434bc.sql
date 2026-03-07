
-- 1. Add region column to ngos
ALTER TABLE public.ngos ADD COLUMN IF NOT EXISTS region text;

-- 2. fiscal_periods