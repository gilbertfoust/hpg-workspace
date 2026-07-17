-- Final security and performance hardening for NGO access, international
-- disbursements, Form 990 preparation, finance analysis, and advanced accounting.

-- The legacy project had deliberately disabled profiles RLS. That would allow
-- anonymous Data API clients to read role/department data and to attempt writes.
-- Internal HPG staff may use the staff directory; NGO users may only read their
-- own profile. Client-side profile edits are restricted to display-safe fields.
alter table public.profiles enable row level security;

revoke all on table public.profiles from anon;
revoke update on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name, avatar_url) on table public.profiles to authenticated;
grant all on table public.profiles to service_role;

drop policy if exists "Users can view own profile or super admin view" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Authenticated users read permitted profiles"
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or (select public.is_internal_user())
);

create policy "Users update own safe profile fields"
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- New finance tables must not inherit historical anonymous default privileges.
revoke all on table
  public.finance_exchange_rates,
  public.finance_vendor_tax_profiles,
  public.finance_vendor_tax_years,
  public.finance_check_stock,
  public.finance_checks,
  public.finance_investment_accounts,
  public.finance_investment_holdings,
  public.finance_investment_valuations
from anon, authenticated;

grant select, insert, update on table
  public.finance_exchange_rates,
  public.finance_vendor_tax_profiles,
  public.finance_vendor_tax_years,
  public.finance_check_stock,
  public.finance_checks,
  public.finance_investment_accounts,
  public.finance_investment_holdings,
  public.finance_investment_valuations
to authenticated;

grant all on table
  public.finance_exchange_rates,
  public.finance_vendor_tax_profiles,
  public.finance_vendor_tax_years,
  public.finance_check_stock,
  public.finance_checks,
  public.finance_investment_accounts,
  public.finance_investment_holdings,
  public.finance_investment_valuations
to service_role;

-- Credential references remain service-role only. The explicit deny policy
-- documents that no browser client may access them and keeps the security
-- advisor from treating the lack of a client policy as accidental.
drop policy if exists "Bank credentials are service role only"
  on public.ngo_bank_connection_credentials;
create policy "Bank credentials are service role only"
on public.ngo_bank_connection_credentials
for all
to anon, authenticated
using (false)
with check (false);

-- These functions are authenticated accounting/portal APIs or trigger-only
-- helpers. They must not be callable by anonymous PostgREST clients.
revoke all on function public.has_ngo_access(uuid) from public, anon;
grant execute on function public.has_ngo_access(uuid) to authenticated;

revoke all on function public.is_finance_ledger_manager() from public, anon;
grant execute on function public.is_finance_ledger_manager() to authenticated;
revoke all on function public.is_finance_staff() from public, anon;
grant execute on function public.is_finance_staff() to authenticated;
revoke all on function public.can_write_finance_drafts() from public, anon;
grant execute on function public.can_write_finance_drafts() to authenticated;
revoke all on function public.can_read_finance_ledger() from public, anon;
grant execute on function public.can_read_finance_ledger() to authenticated;

revoke all on function public.initialize_ngo_portal_onboarding() from public, anon, authenticated;
grant execute on function public.initialize_ngo_portal_onboarding() to service_role;

revoke all on function public.can_access_ngo_storage_object(text) from public, anon;
grant execute on function public.can_access_ngo_storage_object(text) to authenticated;
revoke all on function public.has_ngo_portal_access(uuid) from public, anon;
grant execute on function public.has_ngo_portal_access(uuid) to authenticated;
revoke all on function public.get_my_ngo_id() from public, anon;
grant execute on function public.get_my_ngo_id() to authenticated;

revoke all on function public.can_post_ngo_transaction(uuid) from public, anon;
grant execute on function public.can_post_ngo_transaction(uuid) to authenticated;
revoke all on function public.generate_transaction_number(uuid) from public, anon;
grant execute on function public.generate_transaction_number(uuid) to authenticated;
revoke all on function public.get_open_fiscal_period(uuid, date, uuid) from public, anon;
grant execute on function public.get_open_fiscal_period(uuid, date, uuid) to authenticated;
revoke all on function public.validate_ngo_journal_accounts(uuid, jsonb) from public, anon;
grant execute on function public.validate_ngo_journal_accounts(uuid, jsonb) to authenticated;
revoke all on function public.post_transaction(uuid, date, text, text, text, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.post_transaction(uuid, date, text, text, text, uuid, jsonb, jsonb) to authenticated;
revoke all on function public.save_draft_transaction(uuid, date, text, text, text, uuid, jsonb, uuid) from public, anon;
grant execute on function public.save_draft_transaction(uuid, date, text, text, text, uuid, jsonb, uuid) to authenticated;

-- Use an init-plan for auth.uid() in the membership policy.
drop policy if exists "Members can view own NGO memberships"
  on public.ngo_portal_memberships;
create policy "Members can view own NGO memberships"
on public.ngo_portal_memberships
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.can_manage_ngo_portal_accounts()
);

-- Add covering indexes for every currently uncovered foreign key introduced
-- by this accounting expansion. The catalog-driven block keeps the migration
-- idempotent and avoids duplicating an existing leading-column index.
do $$
declare
  fk record;
begin
  for fk in
    select
      c.conrelid::regclass as relation_name,
      c.conname,
      string_agg(quote_ident(a.attname), ', ' order by keys.ordinality) as columns_sql
    from pg_constraint c
    cross join lateral unnest(c.conkey) with ordinality as keys(attnum, ordinality)
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = keys.attnum
    where c.contype = 'f'
      and c.conrelid in (
        'public.ngo_portal_memberships'::regclass,
        'public.finance_ngo_account_requests'::regclass,
        'public.finance_quarterly_submissions'::regclass,
        'public.ngo_agreement_templates'::regclass,
        'public.ngo_agreements'::regclass,
        'public.ngo_onboarding_payment_sessions'::regclass,
        'public.ngo_portal_onboarding'::regclass,
        'public.ngo_bank_connections'::regclass,
        'public.ngo_bank_connection_audit_events'::regclass,
        'public.ngo_bank_connection_credentials'::regclass,
        'public.ngo_fund_disbursements'::regclass,
        'public.ngo_disbursement_approvals'::regclass,
        'public.ngo_disbursement_events'::regclass,
        'public.ngo_disbursement_outbox'::regclass,
        'public.tax_efile_provider_config'::regclass,
        'public.tax_form_990_returns'::regclass,
        'public.tax_form_990_sections'::regclass,
        'public.tax_form_990_validations'::regclass,
        'public.tax_form_990_artifacts'::regclass,
        'public.tax_form_990_transmission_events'::regclass,
        'public.finance_analysis_runs'::regclass,
        'public.finance_recommendations'::regclass,
        'public.grant_proposal_contributions'::regclass,
        'public.finance_exchange_rates'::regclass,
        'public.finance_vendor_tax_profiles'::regclass,
        'public.finance_vendor_tax_years'::regclass,
        'public.finance_check_stock'::regclass,
        'public.finance_checks'::regclass,
        'public.finance_investment_accounts'::regclass,
        'public.finance_investment_holdings'::regclass,
        'public.finance_investment_valuations'::regclass
      )
      and not exists (
        select 1
        from pg_index i
        where i.indrelid = c.conrelid
          and i.indisvalid
          and c.conkey = (i.indkey::smallint[])[0:cardinality(c.conkey) - 1]
      )
    group by c.conrelid, c.conname
  loop
    execute format(
      'create index if not exists %I on %s (%s)',
      left(fk.conname || '_idx', 63),
      fk.relation_name,
      fk.columns_sql
    );
  end loop;
end
$$;
