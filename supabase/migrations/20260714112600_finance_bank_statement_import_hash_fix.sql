-- The managed project installs pgcrypto in the extensions schema. Keep that
-- trusted schema available to the already-deployed statement import function.
ALTER FUNCTION public.import_finance_bank_statement(
  uuid, uuid, date, date, numeric, numeric, text, text, text, integer, text, jsonb
) SET search_path = public, extensions;

