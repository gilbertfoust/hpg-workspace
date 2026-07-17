-- NGO onboarding agreement/payment state and international bank/payout rails.
-- Plaid is used only where its country/product coverage applies. Payouts use a
-- provider adapter (Stripe Connect, Wise, or a controlled Relay/manual rail).

create table public.ngo_agreement_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version text not null,
  agreement_type text not null default 'fiscal_sponsorship',
  body_markdown text not null,
  status text not null default 'draft' check (status in ('draft','published','retired')),
  effective_date date,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  published_by_user_id uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(name,version)
);

create table public.ngo_agreements (
  id uuid primary key default gen_random_uuid(),
  ngo_id uuid not null references public.ngos(id) on delete cascade,
  template_id uuid not null references public.ngo_agreement_templates(id) on delete restrict,
  agreement_name text not null,
  agreement_version text not null,
  agreement_body_markdown text not null,
  agreement_sha256 text not null,
  status text not null default 'issued' check (status in ('issued','viewed','signed','voided','expired')),
  issued_by_user_id uuid references public.profiles(id) on delete set null,
  issued_at timestamptz not null default now(),
  viewed_at timestamptz,
  signed_by_user_id uuid references public.profiles(id) on delete set null,
  signer_name text,
  signer_title text,
  signature_document_id uuid references public.documents(id) on delete set null,
  electronic_consent boolean not null default false,
  signed_at timestamptz,
  signer_ip_hash text,
  signer_user_agent text,
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index ngo_agreements_active_unique on public.ngo_agreements(ngo_id)
  where status in ('issued','viewed','signed');

create table public.ngo_onboarding_payment_sessions (
  id uuid primary key default gen_random_uuid(),
  ngo_id uuid not null references public.ngos(id) on delete cascade,
  agreement_id uuid references public.ngo_agreements(id) on delete set null,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  provider text not null default 'stripe' check (provider in ('stripe','relay_payment_request','manual')),
  provider_session_id text unique,
  provider_payment_id text,
  provider_status text,
  status text not null default 'created' check (status in ('created','open','paid','failed','expired','refunded')),
  checkout_url text,
  relay_settlement_expected boolean not null default true,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  paid_at timestamptz,
  receipt_document_id uuid references public.documents(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ngo_portal_onboarding (
  ngo_id uuid primary key references public.ngos(id) on delete cascade,
  status text not null default 'account_created' check (
    status in ('account_created','agreement_pending','agreement_signed','payment_pending','payment_verified','bank_pending','ready','activated','blocked')
  ),
  agreement_id uuid references public.ngo_agreements(id) on delete set null,
  payment_session_id uuid references public.ngo_onboarding_payment_sessions(id) on delete set null,
  activated_by_user_id uuid references public.profiles(id) on delete set null,
  activated_at timestamptz,
  blocking_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.ngo_portal_onboarding(ngo_id)
select id from public.ngos on conflict (ngo_id) do nothing;

create or replace function public.initialize_ngo_portal_onboarding()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ngo_portal_onboarding(ngo_id) values(new.id) on conflict do nothing;
  return new;
end;
$$;
create trigger trg_initialize_ngo_portal_onboarding
after insert on public.ngos for each row execute function public.initialize_ngo_portal_onboarding();

create table public.ngo_bank_connections (
  id uuid primary key default gen_random_uuid(),
  ngo_id uuid not null references public.ngos(id) on delete cascade,
  provider text not null check (provider in ('plaid','stripe_connect','wise','relay_manual')),
  connection_purpose text not null default 'both' check (connection_purpose in ('data','payout','both')),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  institution_name text,
  account_name text,
  account_type text,
  account_mask text,
  provider_account_ref text,
  provider_item_ref text,
  provider_recipient_ref text,
  status text not null default 'pending' check (
    status in ('pending','verification_required','verified','restricted','disconnected','failed')
  ),
  capabilities jsonb not null default '{}'::jsonb,
  consented_by_user_id uuid references public.profiles(id) on delete set null,
  consented_at timestamptz,
  verified_at timestamptz,
  last_synced_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider,provider_account_ref)
);

create table public.ngo_bank_connection_audit_events (
  id uuid primary key default gen_random_uuid(),
  bank_connection_id uuid not null references public.ngo_bank_connections(id) on delete cascade,
  event_type text not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  provider_event_id text,
  event_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index ngo_bank_connection_provider_event_unique
  on public.ngo_bank_connection_audit_events(provider_event_id)
  where provider_event_id is not null;

-- Credential references are deliberately outside the public API. Tokens are
-- written only by service-role Edge Functions and should point to a managed
-- secret/Vault record rather than containing a raw access token.
create table public.ngo_bank_connection_credentials (
  bank_connection_id uuid primary key references public.ngo_bank_connections(id) on delete cascade,
  secret_reference text not null,
  created_at timestamptz not null default now(),
  rotated_at timestamptz
);

create table public.ngo_fund_disbursements (
  id uuid primary key default gen_random_uuid(),
  disbursement_number text not null unique default ('NFD-' || to_char(current_date,'YYYY') || '-' || upper(substr(gen_random_uuid()::text,1,8))),
  ngo_id uuid not null references public.ngos(id) on delete restrict,
  bank_connection_id uuid not null references public.ngo_bank_connections(id) on delete restrict,
  source_cash_account_id uuid not null references public.finance_accounts(id) on delete restrict,
  distribution_account_id uuid not null references public.finance_accounts(id) on delete restrict,
  amount numeric(18,2) not null check (amount > 0),
  source_currency text not null default 'USD' check (source_currency ~ '^[A-Z]{3}$'),
  destination_currency text not null default 'USD' check (destination_currency ~ '^[A-Z]{3}$'),
  exchange_rate numeric(20,8),
  destination_amount numeric(18,2),
  purpose text not null,
  memo text,
  status text not null default 'draft' check (
    status in ('draft','pending_approval','approved','queued','processing','paid','failed','cancelled','reversed')
  ),
  required_approvals smallint not null default 2 check (required_approvals between 1 and 3),
  requested_by_user_id uuid not null references public.profiles(id) on delete restrict,
  requested_at timestamptz not null default now(),
  queued_by_user_id uuid references public.profiles(id) on delete set null,
  queued_at timestamptz,
  provider text,
  provider_transfer_id text,
  provider_status text,
  provider_fee numeric(18,2),
  provider_response_json jsonb not null default '{}'::jsonb,
  receipt_document_id uuid references public.documents(id) on delete set null,
  journal_entry_id uuid references public.finance_journal_entries(id) on delete set null,
  paid_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ngo_disbursement_approvals (
  id uuid primary key default gen_random_uuid(),
  disbursement_id uuid not null references public.ngo_fund_disbursements(id) on delete cascade,
  approver_user_id uuid not null references public.profiles(id) on delete restrict,
  decision text not null check (decision in ('approved','rejected')),
  notes text,
  created_at timestamptz not null default now(),
  unique(disbursement_id,approver_user_id)
);

create table public.ngo_disbursement_events (
  id uuid primary key default gen_random_uuid(),
  disbursement_id uuid not null references public.ngo_fund_disbursements(id) on delete cascade,
  event_type text not null,
  provider_event_id text,
  actor_user_id uuid references public.profiles(id) on delete set null,
  event_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index ngo_disbursement_provider_event_unique
  on public.ngo_disbursement_events(provider_event_id)
  where provider_event_id is not null;

create table public.ngo_disbursement_outbox (
  id uuid primary key default gen_random_uuid(),
  disbursement_id uuid not null unique references public.ngo_fund_disbursements(id) on delete cascade,
  provider text not null,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed')),
  attempt_count integer not null default 0,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ngo_fund_disbursements_queue_idx on public.ngo_fund_disbursements(status,created_at,ngo_id);
create index ngo_bank_connections_ngo_status_idx on public.ngo_bank_connections(ngo_id,status,provider);
create index ngo_disbursement_approvals_disbursement_idx on public.ngo_disbursement_approvals(disbursement_id,decision);

create trigger trg_ngo_agreement_templates_updated_at before update on public.ngo_agreement_templates for each row execute function public.update_updated_at_column();
create trigger trg_ngo_agreements_updated_at before update on public.ngo_agreements for each row execute function public.update_updated_at_column();
create trigger trg_ngo_onboarding_payments_updated_at before update on public.ngo_onboarding_payment_sessions for each row execute function public.update_updated_at_column();
create trigger trg_ngo_portal_onboarding_updated_at before update on public.ngo_portal_onboarding for each row execute function public.update_updated_at_column();
create trigger trg_ngo_bank_connections_updated_at before update on public.ngo_bank_connections for each row execute function public.update_updated_at_column();
create trigger trg_ngo_fund_disbursements_updated_at before update on public.ngo_fund_disbursements for each row execute function public.update_updated_at_column();
create trigger trg_ngo_disbursement_outbox_updated_at before update on public.ngo_disbursement_outbox for each row execute function public.update_updated_at_column();

alter table public.ngo_agreement_templates enable row level security;
alter table public.ngo_agreements enable row level security;
alter table public.ngo_onboarding_payment_sessions enable row level security;
alter table public.ngo_portal_onboarding enable row level security;
alter table public.ngo_bank_connections enable row level security;
alter table public.ngo_bank_connection_audit_events enable row level security;
alter table public.ngo_bank_connection_credentials enable row level security;
alter table public.ngo_fund_disbursements enable row level security;
alter table public.ngo_disbursement_approvals enable row level security;
alter table public.ngo_disbursement_events enable row level security;
alter table public.ngo_disbursement_outbox enable row level security;

create policy "Published agreement templates are readable" on public.ngo_agreement_templates for select to authenticated
  using (status = 'published' or public.is_super_admin() or public.current_staff_department_name() in ('legal','administration'));
create policy "Legal and admins manage agreement templates" on public.ngo_agreement_templates for all to authenticated
  using (public.is_super_admin() or public.current_staff_department_name() in ('legal','administration'))
  with check (public.is_super_admin() or public.current_staff_department_name() in ('legal','administration'));
create policy "NGO and internal users read agreements" on public.ngo_agreements for select to authenticated
  using (public.has_ngo_finance_access(ngo_id,'viewer') or public.is_internal_user());
create policy "NGO and Finance read onboarding payments" on public.ngo_onboarding_payment_sessions for select to authenticated
  using (public.has_ngo_finance_access(ngo_id,'viewer') or public.is_finance_staff());
create policy "NGO and internal users read onboarding" on public.ngo_portal_onboarding for select to authenticated
  using (public.has_ngo_access(ngo_id) or public.is_internal_user());
create policy "NGO and Finance read bank connections" on public.ngo_bank_connections for select to authenticated
  using (public.has_ngo_finance_access(ngo_id,'viewer') or public.is_finance_staff());
create policy "NGO and Finance read bank audit" on public.ngo_bank_connection_audit_events for select to authenticated
  using (exists (
    select 1 from public.ngo_bank_connections c where c.id = bank_connection_id
      and (public.has_ngo_finance_access(c.ngo_id,'viewer') or public.is_finance_staff())
  ));
create policy "NGO and Finance read disbursements" on public.ngo_fund_disbursements for select to authenticated
  using (public.has_ngo_finance_access(ngo_id,'viewer') or public.is_finance_staff());
create policy "Finance reads disbursement approvals" on public.ngo_disbursement_approvals for select to authenticated
  using (public.is_finance_staff());
create policy "NGO and Finance read disbursement events" on public.ngo_disbursement_events for select to authenticated
  using (exists (
    select 1 from public.ngo_fund_disbursements d where d.id = disbursement_id
      and (public.has_ngo_finance_access(d.ngo_id,'viewer') or public.is_finance_staff())
  ));
create policy "Finance reads disbursement outbox" on public.ngo_disbursement_outbox for select to authenticated
  using (public.is_finance_ledger_manager());

revoke all on public.ngo_agreement_templates, public.ngo_agreements,
  public.ngo_onboarding_payment_sessions, public.ngo_portal_onboarding,
  public.ngo_bank_connections, public.ngo_bank_connection_audit_events,
  public.ngo_bank_connection_credentials, public.ngo_fund_disbursements,
  public.ngo_disbursement_approvals, public.ngo_disbursement_events,
  public.ngo_disbursement_outbox from anon, authenticated;
grant select on public.ngo_agreement_templates, public.ngo_agreements,
  public.ngo_onboarding_payment_sessions, public.ngo_portal_onboarding,
  public.ngo_bank_connections, public.ngo_bank_connection_audit_events,
  public.ngo_fund_disbursements, public.ngo_disbursement_approvals,
  public.ngo_disbursement_events, public.ngo_disbursement_outbox to authenticated;
grant all on public.ngo_agreement_templates, public.ngo_agreements,
  public.ngo_onboarding_payment_sessions, public.ngo_portal_onboarding,
  public.ngo_bank_connections, public.ngo_bank_connection_audit_events,
  public.ngo_bank_connection_credentials, public.ngo_fund_disbursements,
  public.ngo_disbursement_approvals, public.ngo_disbursement_events,
  public.ngo_disbursement_outbox to service_role;

create or replace function public.issue_ngo_agreement(p_ngo_id uuid,p_template_id uuid)
returns public.ngo_agreements
language plpgsql
security definer
set search_path = public
as $$
declare template_row public.ngo_agreement_templates; agreement_row public.ngo_agreements;
begin
  if auth.uid() is null or not (
    public.is_super_admin() or public.current_staff_department_name() in ('legal','administration')
  ) then raise exception 'HPG Legal or admin access required'; end if;
  select * into template_row from public.ngo_agreement_templates where id = p_template_id and status = 'published';
  if template_row.id is null then raise exception 'Select a published agreement template'; end if;
  update public.ngo_agreements set status = 'voided',voided_at = now(),void_reason = 'Superseded'
  where ngo_id = p_ngo_id and status in ('issued','viewed');
  insert into public.ngo_agreements(
    ngo_id,template_id,agreement_name,agreement_version,agreement_body_markdown,
    agreement_sha256,issued_by_user_id
  ) values (
    p_ngo_id,template_row.id,template_row.name,template_row.version,template_row.body_markdown,
    encode(digest(template_row.body_markdown,'sha256'),'hex'),auth.uid()
  ) returning * into agreement_row;
  insert into public.ngo_portal_onboarding(ngo_id,status,agreement_id)
  values(p_ngo_id,'agreement_pending',agreement_row.id)
  on conflict(ngo_id) do update set status='agreement_pending',agreement_id=excluded.agreement_id,updated_at=now();
  return agreement_row;
end;
$$;

create or replace function public.sign_ngo_agreement(
  p_agreement_id uuid,
  p_signer_name text,
  p_signer_title text,
  p_signature_document_id uuid,
  p_electronic_consent boolean
)
returns public.ngo_agreements
language plpgsql
security definer
set search_path = public
as $$
declare agreement_row public.ngo_agreements;
begin
  select * into agreement_row from public.ngo_agreements where id = p_agreement_id for update;
  if agreement_row.id is null then raise exception 'Agreement not found'; end if;
  if not public.has_ngo_finance_access(agreement_row.ngo_id,'approver') then raise exception 'NGO approver access required'; end if;
  if agreement_row.status not in ('issued','viewed') then raise exception 'Agreement is not open for signature'; end if;
  if not p_electronic_consent then raise exception 'Electronic signature consent is required'; end if;
  if nullif(trim(p_signer_name),'') is null or nullif(trim(p_signer_title),'') is null then raise exception 'Signer name and title are required'; end if;
  if not exists(select 1 from public.documents d where d.id=p_signature_document_id and d.ngo_id=agreement_row.ngo_id) then
    raise exception 'Signature evidence must belong to this NGO';
  end if;
  update public.ngo_agreements set status='signed',signed_by_user_id=auth.uid(),
    signer_name=trim(p_signer_name),signer_title=trim(p_signer_title),
    signature_document_id=p_signature_document_id,electronic_consent=true,signed_at=now()
  where id=p_agreement_id returning * into agreement_row;
  update public.ngo_portal_onboarding set status='payment_pending',agreement_id=agreement_row.id,updated_at=now()
  where ngo_id=agreement_row.ngo_id;
  return agreement_row;
end;
$$;

create or replace function public.request_ngo_disbursement(
  p_ngo_id uuid,
  p_bank_connection_id uuid,
  p_source_cash_account_id uuid,
  p_distribution_account_id uuid,
  p_amount numeric,
  p_source_currency text,
  p_destination_currency text,
  p_purpose text,
  p_memo text default null
)
returns public.ngo_fund_disbursements
language plpgsql
security definer
set search_path = public
as $$
declare row_out public.ngo_fund_disbursements; connection public.ngo_bank_connections;
begin
  if auth.uid() is null or not public.is_finance_staff() then raise exception 'Finance access required'; end if;
  select * into connection from public.ngo_bank_connections where id=p_bank_connection_id and ngo_id=p_ngo_id and status='verified';
  if connection.id is null then raise exception 'Select a verified NGO payout account'; end if;
  if coalesce(p_amount,0)<=0 or nullif(trim(p_purpose),'') is null then raise exception 'Amount and purpose are required'; end if;
  if not exists(select 1 from public.finance_ngo_accounts n join public.finance_accounts a on a.id=n.account_id where n.ngo_id=p_ngo_id and n.account_id=p_source_cash_account_id and n.is_active and a.account_type='asset') then raise exception 'Source cash account is not active for this NGO'; end if;
  if not exists(select 1 from public.finance_ngo_accounts n join public.finance_accounts a on a.id=n.account_id where n.ngo_id=p_ngo_id and n.account_id=p_distribution_account_id and n.is_active and a.account_type in ('expense','asset','liability')) then raise exception 'Distribution account is not active for this NGO'; end if;
  insert into public.ngo_fund_disbursements(
    ngo_id,bank_connection_id,source_cash_account_id,distribution_account_id,amount,
    source_currency,destination_currency,purpose,memo,status,requested_by_user_id
  ) values (
    p_ngo_id,p_bank_connection_id,p_source_cash_account_id,p_distribution_account_id,round(p_amount,2),
    upper(p_source_currency),upper(p_destination_currency),trim(p_purpose),nullif(trim(p_memo),''),'pending_approval',auth.uid()
  ) returning * into row_out;
  insert into public.ngo_disbursement_events(disbursement_id,event_type,actor_user_id,event_json)
  values(row_out.id,'requested',auth.uid(),jsonb_build_object('amount',row_out.amount,'currency',row_out.source_currency));
  return row_out;
end;
$$;

create or replace function public.verify_ngo_bank_connection(
  p_connection_id uuid,
  p_provider_recipient_ref text,
  p_capabilities jsonb default '{}'::jsonb
)
returns public.ngo_bank_connections
language plpgsql
security definer
set search_path = public
as $$
declare row_out public.ngo_bank_connections;
begin
  if auth.uid() is null or not public.is_finance_ledger_manager() then
    raise exception 'Finance manager access required';
  end if;
  update public.ngo_bank_connections set
    status='verified',provider_recipient_ref=coalesce(nullif(trim(p_provider_recipient_ref),''),provider_recipient_ref),
    capabilities=coalesce(p_capabilities,'{}'::jsonb),verified_at=now(),last_error=null
  where id=p_connection_id returning * into row_out;
  if row_out.id is null then raise exception 'Bank connection not found'; end if;
  insert into public.ngo_bank_connection_audit_events(bank_connection_id,event_type,actor_user_id,event_json)
  values(row_out.id,'finance_verified',auth.uid(),jsonb_build_object('capabilities',row_out.capabilities));
  return row_out;
end;
$$;

create or replace function public.approve_ngo_disbursement(
  p_disbursement_id uuid,
  p_decision text,
  p_notes text default null
)
returns public.ngo_fund_disbursements
language plpgsql
security definer
set search_path = public
as $$
declare row_out public.ngo_fund_disbursements; approval_count integer;
begin
  if auth.uid() is null or not public.is_finance_ledger_manager() then raise exception 'Finance manager access required'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'Decision must be approved or rejected'; end if;
  select * into row_out from public.ngo_fund_disbursements where id=p_disbursement_id for update;
  if row_out.id is null or row_out.status not in ('pending_approval','approved') then raise exception 'Disbursement is not awaiting approval'; end if;
  if row_out.requested_by_user_id=auth.uid() then raise exception 'Requester cannot approve their own disbursement'; end if;
  insert into public.ngo_disbursement_approvals(disbursement_id,approver_user_id,decision,notes)
  values(p_disbursement_id,auth.uid(),p_decision,nullif(trim(p_notes),''))
  on conflict(disbursement_id,approver_user_id) do update set decision=excluded.decision,notes=excluded.notes,created_at=now();
  if p_decision='rejected' then
    update public.ngo_fund_disbursements set status='cancelled',failure_reason=coalesce(nullif(trim(p_notes),''),'Rejected by Finance') where id=p_disbursement_id returning * into row_out;
  else
    select count(*) into approval_count from public.ngo_disbursement_approvals where disbursement_id=p_disbursement_id and decision='approved';
    if approval_count >= row_out.required_approvals then
      update public.ngo_fund_disbursements set status='approved' where id=p_disbursement_id returning * into row_out;
    end if;
  end if;
  insert into public.ngo_disbursement_events(disbursement_id,event_type,actor_user_id,event_json)
  values(p_disbursement_id,p_decision,auth.uid(),jsonb_build_object('notes',p_notes));
  return row_out;
end;
$$;

create or replace function public.queue_ngo_disbursement(p_disbursement_id uuid)
returns public.ngo_fund_disbursements
language plpgsql
security definer
set search_path = public
as $$
declare row_out public.ngo_fund_disbursements; connection public.ngo_bank_connections;
begin
  if auth.uid() is null or not public.is_finance_ledger_manager() then raise exception 'Finance manager access required'; end if;
  select * into row_out from public.ngo_fund_disbursements where id=p_disbursement_id for update;
  if row_out.id is null or row_out.status<>'approved' then raise exception 'Disbursement requires all approvals'; end if;
  select * into connection from public.ngo_bank_connections where id=row_out.bank_connection_id and status='verified';
  if connection.id is null then raise exception 'Payout account is not verified'; end if;
  if not coalesce((connection.capabilities->>'payouts')::boolean,false) then
    raise exception 'This connection is for bank data only. Complete Stripe Connect, Wise, or Finance-verified payout onboarding.';
  end if;
  update public.ngo_fund_disbursements set status='queued',provider=connection.provider,queued_by_user_id=auth.uid(),queued_at=now()
  where id=p_disbursement_id returning * into row_out;
  insert into public.ngo_disbursement_outbox(disbursement_id,provider) values(row_out.id,connection.provider)
  on conflict(disbursement_id) do update set status='queued',available_at=now(),last_error=null,updated_at=now();
  insert into public.ngo_disbursement_events(disbursement_id,event_type,actor_user_id,event_json)
  values(row_out.id,'queued',auth.uid(),jsonb_build_object('provider',connection.provider));
  return row_out;
end;
$$;

-- Called only by a service-role payout processor after provider verification.
create or replace function public.record_ngo_disbursement_provider_result(
  p_disbursement_id uuid,
  p_provider_event_id text,
  p_provider_transfer_id text,
  p_provider_status text,
  p_result_status text,
  p_provider_response jsonb,
  p_destination_amount numeric default null,
  p_exchange_rate numeric default null,
  p_provider_fee numeric default null,
  p_receipt_file_path text default null,
  p_receipt_file_name text default null,
  p_receipt_file_type text default null,
  p_receipt_file_size integer default null,
  p_failure_reason text default null
)
returns public.ngo_fund_disbursements
language plpgsql
security definer
set search_path = public
as $$
declare row_out public.ngo_fund_disbursements; receipt_id uuid; entry_id uuid; period_id uuid;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Service role required'; end if;
  if p_result_status not in ('processing','paid','failed') then raise exception 'Unsupported provider result status'; end if;
  select * into row_out from public.ngo_fund_disbursements where id=p_disbursement_id for update;
  if row_out.id is null then raise exception 'Disbursement not found'; end if;
  insert into public.ngo_disbursement_events(disbursement_id,event_type,provider_event_id,event_json)
  values(row_out.id,'provider_'||p_result_status,p_provider_event_id,coalesce(p_provider_response,'{}'::jsonb))
  on conflict(provider_event_id) where provider_event_id is not null do nothing;

  if p_result_status='paid' and row_out.status<>'paid' then
    if p_receipt_file_path is null or p_receipt_file_name is null or coalesce(p_receipt_file_size,0)<=0 then
      raise exception 'A paid disbursement requires an archived provider receipt';
    end if;
    insert into public.documents(ngo_id,file_path,file_name,file_type,file_size,category,review_status,title)
    values(row_out.ngo_id,p_receipt_file_path,p_receipt_file_name,coalesce(p_receipt_file_type,'application/json'),p_receipt_file_size,'finance','approved','Wire receipt — '||row_out.disbursement_number)
    returning id into receipt_id;
    period_id:=public.get_finance_open_fiscal_period(current_date,null,row_out.ngo_id);
    insert into public.finance_journal_entries(entry_date,memo,source_type,source_id,status,created_by_user_id,ngo_id,fiscal_period_id)
    values(current_date,'NGO funding '||row_out.disbursement_number,'ngo_fund_disbursement',row_out.id,'draft',null,row_out.ngo_id,period_id)
    returning id into entry_id;
    insert into public.finance_journal_lines(journal_entry_id,account_id,debit,credit,memo,ngo_id,document_id,line_number)
    values
      (entry_id,row_out.distribution_account_id,row_out.amount,0,row_out.purpose,row_out.ngo_id,receipt_id,1),
      (entry_id,row_out.source_cash_account_id,0,row_out.amount,row_out.disbursement_number,row_out.ngo_id,receipt_id,2);
    perform public.finance_validate_journal_entity_scope(entry_id);
    update public.finance_journal_entries set status='posted',posted_at=now(),updated_at=now() where id=entry_id;
    insert into public.finance_document_links(document_id,entity_type,entity_id,link_notes)
    values(receipt_id,'journal_entry',entry_id,'Archived payout receipt') on conflict do nothing;
  end if;

  update public.ngo_fund_disbursements set
    status=p_result_status,provider_transfer_id=coalesce(p_provider_transfer_id,provider_transfer_id),
    provider_status=p_provider_status,provider_response_json=coalesce(provider_response_json,'{}'::jsonb)||coalesce(p_provider_response,'{}'::jsonb),
    destination_amount=coalesce(p_destination_amount,destination_amount),exchange_rate=coalesce(p_exchange_rate,exchange_rate),
    provider_fee=coalesce(p_provider_fee,provider_fee),receipt_document_id=coalesce(receipt_id,receipt_document_id),
    journal_entry_id=coalesce(entry_id,journal_entry_id),paid_at=case when p_result_status='paid' then now() else paid_at end,
    failed_at=case when p_result_status='failed' then now() else failed_at end,failure_reason=p_failure_reason
  where id=row_out.id returning * into row_out;
  update public.ngo_disbursement_outbox set status=case when p_result_status='paid' then 'completed' when p_result_status='failed' then 'failed' else 'processing' end,
    last_error=p_failure_reason,updated_at=now() where disbursement_id=row_out.id;
  return row_out;
end;
$$;

create or replace function public.complete_manual_ngo_disbursement(
  p_disbursement_id uuid,
  p_receipt_document_id uuid,
  p_provider_reference text,
  p_paid_date date default current_date
)
returns public.ngo_fund_disbursements
language plpgsql
security definer
set search_path = public
as $$
declare row_out public.ngo_fund_disbursements; connection public.ngo_bank_connections; entry_id uuid; period_id uuid;
begin
  if auth.uid() is null or not public.is_finance_ledger_manager() then raise exception 'Finance manager access required'; end if;
  select * into row_out from public.ngo_fund_disbursements where id=p_disbursement_id for update;
  if row_out.id is null or row_out.status not in ('queued','processing') then raise exception 'Disbursement is not ready to complete'; end if;
  select * into connection from public.ngo_bank_connections where id=row_out.bank_connection_id;
  if row_out.status='queued' and connection.provider <> 'relay_manual' then raise exception 'Automatic providers must confirm processing before manual settlement verification'; end if;
  if nullif(trim(p_provider_reference),'') is null then raise exception 'Provider payment or wire reference is required'; end if;
  if not exists(select 1 from public.documents d where d.id=p_receipt_document_id and d.ngo_id=row_out.ngo_id) then raise exception 'Receipt must belong to the funded NGO'; end if;
  period_id:=public.get_finance_open_fiscal_period(coalesce(p_paid_date,current_date),null,row_out.ngo_id);
  insert into public.finance_journal_entries(entry_date,memo,source_type,source_id,status,created_by_user_id,ngo_id,fiscal_period_id)
  values(coalesce(p_paid_date,current_date),'NGO funding '||row_out.disbursement_number,'ngo_fund_disbursement',row_out.id,'draft',auth.uid(),row_out.ngo_id,period_id)
  returning id into entry_id;
  insert into public.finance_journal_lines(journal_entry_id,account_id,debit,credit,memo,ngo_id,document_id,line_number)
  values
    (entry_id,row_out.distribution_account_id,row_out.amount,0,row_out.purpose,row_out.ngo_id,p_receipt_document_id,1),
    (entry_id,row_out.source_cash_account_id,0,row_out.amount,trim(p_provider_reference),row_out.ngo_id,p_receipt_document_id,2);
  perform public.finance_validate_journal_entity_scope(entry_id);
  update public.finance_journal_entries set status='posted',posted_at=now(),approved_by_user_id=auth.uid(),updated_at=now() where id=entry_id;
  insert into public.finance_document_links(document_id,entity_type,entity_id,link_notes,created_by_user_id)
  values(p_receipt_document_id,'journal_entry',entry_id,'Verified payout receipt',auth.uid()) on conflict do nothing;
  update public.ngo_fund_disbursements set status='paid',provider_transfer_id=trim(p_provider_reference),provider_status='completed',
    receipt_document_id=p_receipt_document_id,journal_entry_id=entry_id,paid_at=now()
  where id=row_out.id returning * into row_out;
  update public.ngo_disbursement_outbox set status='completed',updated_at=now() where disbursement_id=row_out.id;
  insert into public.ngo_disbursement_events(disbursement_id,event_type,actor_user_id,event_json)
  values(row_out.id,'provider_receipt_archived',auth.uid(),jsonb_build_object('provider',connection.provider,'reference',p_provider_reference,'document_id',p_receipt_document_id));
  return row_out;
end;
$$;

revoke all on function public.issue_ngo_agreement(uuid,uuid) from public,anon;
revoke all on function public.sign_ngo_agreement(uuid,text,text,uuid,boolean) from public,anon;
revoke all on function public.request_ngo_disbursement(uuid,uuid,uuid,uuid,numeric,text,text,text,text) from public,anon;
revoke all on function public.verify_ngo_bank_connection(uuid,text,jsonb) from public,anon;
revoke all on function public.approve_ngo_disbursement(uuid,text,text) from public,anon;
revoke all on function public.queue_ngo_disbursement(uuid) from public,anon;
revoke all on function public.record_ngo_disbursement_provider_result(uuid,text,text,text,text,jsonb,numeric,numeric,numeric,text,text,text,integer,text) from public,anon,authenticated;
revoke all on function public.complete_manual_ngo_disbursement(uuid,uuid,text,date) from public,anon;
grant execute on function public.issue_ngo_agreement(uuid,uuid) to authenticated;
grant execute on function public.sign_ngo_agreement(uuid,text,text,uuid,boolean) to authenticated;
grant execute on function public.request_ngo_disbursement(uuid,uuid,uuid,uuid,numeric,text,text,text,text) to authenticated;
grant execute on function public.verify_ngo_bank_connection(uuid,text,jsonb) to authenticated;
grant execute on function public.approve_ngo_disbursement(uuid,text,text) to authenticated;
grant execute on function public.queue_ngo_disbursement(uuid) to authenticated;
grant execute on function public.record_ngo_disbursement_provider_result(uuid,text,text,text,text,jsonb,numeric,numeric,numeric,text,text,text,integer,text) to service_role;
grant execute on function public.complete_manual_ngo_disbursement(uuid,uuid,text,date) to authenticated;

comment on table public.ngo_bank_connections is 'Country-aware NGO bank connection metadata. Provider access tokens are never exposed through this table.';
comment on table public.ngo_fund_disbursements is 'Dual-approved NGO funding payout whose provider receipt and balanced journal entry are required before paid status.';
