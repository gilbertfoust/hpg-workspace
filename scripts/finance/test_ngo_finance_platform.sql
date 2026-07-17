-- Read-only production contract test for the NGO accounting expansion.
-- Run in the Supabase SQL editor after applying all finance migrations.

do $$
declare
  expected_tables text[] := array[
    'profiles', 'ngo_portal_memberships', 'finance_ngo_account_requests',
    'finance_quarterly_submissions', 'ngo_agreement_templates', 'ngo_agreements',
    'ngo_onboarding_payment_sessions', 'ngo_portal_onboarding', 'ngo_bank_connections',
    'ngo_bank_connection_audit_events', 'ngo_bank_connection_credentials',
    'ngo_fund_disbursements', 'ngo_disbursement_approvals', 'ngo_disbursement_events',
    'ngo_disbursement_outbox', 'tax_efile_provider_config', 'tax_form_990_returns',
    'tax_form_990_sections', 'tax_form_990_validations', 'tax_form_990_artifacts',
    'tax_form_990_transmission_events', 'finance_analysis_runs', 'finance_recommendations',
    'grant_proposal_contributions', 'finance_exchange_rates', 'finance_vendor_tax_profiles',
    'finance_vendor_tax_years', 'finance_check_stock', 'finance_checks',
    'finance_investment_accounts', 'finance_investment_holdings',
    'finance_investment_valuations'
  ];
  table_name text;
  table_oid oid;
begin
  foreach table_name in array expected_tables loop
    select c.oid
      into table_oid
    from pg_class c
    where c.relnamespace = 'public'::regnamespace
      and c.relname = table_name
      and c.relkind in ('r', 'p');

    if table_oid is null then
      raise exception 'Missing required table: public.%', table_name;
    end if;

    if not (select relrowsecurity from pg_class where oid = table_oid) then
      raise exception 'RLS is disabled on public.%', table_name;
    end if;

    if has_table_privilege('anon', table_oid, 'SELECT')
       or has_table_privilege('anon', table_oid, 'INSERT')
       or has_table_privilege('anon', table_oid, 'UPDATE')
       or has_table_privilege('anon', table_oid, 'DELETE') then
      raise exception 'Anonymous table privilege remains on public.%', table_name;
    end if;
  end loop;

  if has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE')
     or has_column_privilege('authenticated', 'public.profiles', 'department_id', 'UPDATE')
     or has_column_privilege('authenticated', 'public.profiles', 'org_rank', 'UPDATE') then
    raise exception 'Authenticated clients can directly change protected profile authority fields';
  end if;

  if not has_column_privilege('authenticated', 'public.profiles', 'avatar_url', 'UPDATE') then
    raise exception 'Safe self-service profile updates are not available';
  end if;

  if has_function_privilege('anon', 'public.has_ngo_access(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.post_transaction(uuid,date,text,text,text,uuid,jsonb,jsonb)', 'EXECUTE')
     or has_function_privilege('anon', 'public.save_draft_transaction(uuid,date,text,text,text,uuid,jsonb,uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.is_finance_staff()', 'EXECUTE') then
    raise exception 'Anonymous finance RPC execution remains enabled';
  end if;

  raise notice 'PASS: NGO finance platform schema, RLS, grants, and RPC boundaries are present';
end
$$;
