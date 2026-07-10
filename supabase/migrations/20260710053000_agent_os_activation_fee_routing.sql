-- Agent OS jurisdiction-specific NGO activation fee routing
--
-- Business rule:
--   * U.S. NGOs receive the existing U.S. onboarding fee form.
--   * Non-U.S. NGOs do not receive the U.S. form. They receive the dedicated
--     International NGO Activation Fee Form and pay a fixed USD 100 fee.
--   * The confirmation letter cannot be issued until Finance has verified the
--     applicable payment.
--
-- This migration creates policy and routing data only. It does not charge a
-- card, send email, or activate an NGO automatically.

create table if not exists public.agent_os_activation_fee_policies (
  policy_key text primary key,
  name text not null,
  jurisdiction_class text not null
    check (jurisdiction_class in ('us_domestic', 'international')),
  form_template_name text not null,
  amount_cents integer
    check (amount_cents is null or amount_cents >= 0),
  currency text not null default 'USD'
    check (currency ~ '^[A-Z]{3}$'),
  payment_required boolean not null default true,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.form_templates (
  module,
  name,
  description,
  schema_json,
  mapping_json,
  version,
  is_active,
  form_audience,
  intake_module,
  audience,
  portal_visible,
  triage_required
) values (
  'finance'::public.module_type,
  'International NGO Activation Fee Form — $100 USD',
  'For non-U.S. NGOs after the fiscal sponsorship agreement is signed. The fixed activation fee is $100 USD. Finance verifies payment before HPG issues the confirmation letter.',
  jsonb_build_object(
    'fields', jsonb_build_array(
      jsonb_build_object('name','ngo_profile_number','type','text','label','HPG NGO Profile Number','required',true),
      jsonb_build_object('name','legal_organization_name','type','text','label','Legal Organization Name','required',true),
      jsonb_build_object('name','country','type','text','label','Country of Registration or Primary Operation','required',true),
      jsonb_build_object('name','authorized_representative','type','text','label','Authorized Representative','required',true),
      jsonb_build_object('name','billing_email','type','email','label','Billing Email','required',true),
      jsonb_build_object('name','fee_amount_usd','type','number','label','Activation Fee Amount (USD)','required',true),
      jsonb_build_object('name','payment_method','type','select','label','Payment Method','options',jsonb_build_array('Online payment link','Bank transfer','Other method approved by HPG Finance'),'required',true),
      jsonb_build_object('name','payment_reference','type','text','label','Payment or Transaction Reference','required',false),
      jsonb_build_object('name','payer_name','type','text','label','Name of Person or Organization Making Payment','required',true),
      jsonb_build_object('name','agreement_acknowledgment','type','checkbox','label','I confirm that the HPG fiscal sponsorship agreement has been signed and that this payment is the $100 USD international NGO activation fee.','required',true),
      jsonb_build_object('name','accuracy_confirmation','type','checkbox','label','I certify that the information provided is accurate and authorized by the organization.','required',true),
      jsonb_build_object('name','finance_notes','type','textarea','label','Payment Notes or Questions','required',false)
    ),
    'fixed_values', jsonb_build_object(
      'fee_amount_usd', 100,
      'currency', 'USD',
      'jurisdiction_class', 'international'
    )
  ),
  jsonb_build_object(
    'create_work_item', true,
    'work_item_type', 'international_ngo_activation_fee',
    'work_item_title', 'International NGO Activation Fee Verification',
    'work_item_priority', 'high',
    'external_visible', true,
    'titleField', 'legal_organization_name',
    'route_to_module', 'finance',
    'case_stage', 'onboarding_fee_payment_pending',
    'fixed_amount_cents', 10000,
    'currency', 'USD'
  ),
  1,
  true,
  'ngo_portal',
  'finance'::public.module_type,
  'ngo_portal',
  true,
  true
)
on conflict (module, name) do update set
  description = excluded.description,
  schema_json = excluded.schema_json,
  mapping_json = excluded.mapping_json,
  version = greatest(coalesce(public.form_templates.version, 1), excluded.version),
  is_active = true,
  form_audience = excluded.form_audience,
  intake_module = excluded.intake_module,
  audience = excluded.audience,
  portal_visible = excluded.portal_visible,
  triage_required = excluded.triage_required,
  updated_at = now();

insert into public.agent_os_activation_fee_policies (
  policy_key,
  name,
  jurisdiction_class,
  form_template_name,
  amount_cents,
  currency,
  payment_required,
  metadata
) values
  (
    'us_ngo_onboarding_fee',
    'U.S. NGO Onboarding Fee',
    'us_domestic',
    'U.S. NGO Onboarding Fee Form',
    null,
    'USD',
    true,
    jsonb_build_object(
      'amount_source', 'existing_us_form_or_finance_configuration',
      'rule', 'Only U.S. NGOs receive the existing U.S. onboarding fee form.'
    )
  ),
  (
    'international_ngo_activation_fee',
    'International NGO Activation Fee',
    'international',
    'International NGO Activation Fee Form — $100 USD',
    10000,
    'USD',
    true,
    jsonb_build_object(
      'fixed_amount_usd', 100,
      'rule', 'Non-U.S. NGOs receive the dedicated international form and never receive the U.S. onboarding fee form.'
    )
  )
on conflict (policy_key) do update set
  name = excluded.name,
  jurisdiction_class = excluded.jurisdiction_class,
  form_template_name = excluded.form_template_name,
  amount_cents = excluded.amount_cents,
  currency = excluded.currency,
  payment_required = excluded.payment_required,
  active = true,
  metadata = excluded.metadata,
  updated_at = now();

alter table public.case_registry
  add column if not exists applicant_country text,
  add column if not exists jurisdiction_class text,
  add column if not exists activation_fee_policy_key text references public.agent_os_activation_fee_policies(policy_key) on delete set null,
  add column if not exists activation_fee_amount_cents integer,
  add column if not exists activation_fee_currency text,
  add column if not exists activation_fee_form_template_id uuid references public.form_templates(id) on delete set null,
  add column if not exists activation_fee_form_sent_at timestamptz,
  add column if not exists activation_fee_verified_at timestamptz,
  add column if not exists activation_fee_payment_reference text;

alter table public.ngos
  add column if not exists jurisdiction_class text,
  add column if not exists activation_fee_policy_key text references public.agent_os_activation_fee_policies(policy_key) on delete set null,
  add column if not exists activation_fee_amount_cents integer,
  add column if not exists activation_fee_currency text,
  add column if not exists activation_fee_form_template_id uuid references public.form_templates(id) on delete set null,
  add column if not exists activation_fee_form_sent_at timestamptz,
  add column if not exists activation_fee_verified_at timestamptz,
  add column if not exists activation_fee_payment_reference text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'case_registry_jurisdiction_class_check'
  ) then
    alter table public.case_registry
      add constraint case_registry_jurisdiction_class_check
      check (jurisdiction_class is null or jurisdiction_class in ('us_domestic','international'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'ngos_jurisdiction_class_check'
  ) then
    alter table public.ngos
      add constraint ngos_jurisdiction_class_check
      check (jurisdiction_class is null or jurisdiction_class in ('us_domestic','international'));
  end if;
end $$;

create or replace function public.agent_os_is_us_country(p_country text)
returns boolean
language sql
immutable
as $$
  select lower(regexp_replace(coalesce(p_country,''), '[^a-zA-Z]', '', 'g')) in (
    'us',
    'usa',
    'unitedstates',
    'unitedstatesofamerica'
  );
$$;

create or replace function public.agent_os_route_activation_fee(p_case_id uuid)
returns public.case_registry
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case public.case_registry;
  v_country text;
  v_jurisdiction text;
  v_policy public.agent_os_activation_fee_policies;
  v_form_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_internal_user() then
    raise exception 'Internal HPG authority is required to route an activation fee';
  end if;

  select * into v_case
  from public.case_registry
  where id = p_case_id
  for update;

  if not found then
    raise exception 'Agent OS case not found';
  end if;

  if v_case.case_type not in ('sponsorship','ngo','ngo_inquiry') then
    raise exception 'Activation fee routing is only valid for an NGO sponsorship case';
  end if;

  select coalesce(nullif(btrim(v_case.applicant_country), ''), nullif(btrim(n.country), ''))
    into v_country
  from public.ngos n
  where n.id = v_case.ngo_id;

  if v_country is null then
    v_country := nullif(btrim(v_case.metadata->>'country'), '');
  end if;

  if v_country is null then
    raise exception 'Country is required before an activation fee form can be routed';
  end if;

  v_jurisdiction := case
    when public.agent_os_is_us_country(v_country) then 'us_domestic'
    else 'international'
  end;

  select * into v_policy
  from public.agent_os_activation_fee_policies
  where jurisdiction_class = v_jurisdiction and active = true
  order by created_at
  limit 1;

  if not found then
    raise exception 'No active fee policy is configured for jurisdiction %', v_jurisdiction;
  end if;

  select id into v_form_id
  from public.form_templates
  where name = v_policy.form_template_name
    and is_active = true
  order by updated_at desc
  limit 1;

  -- The existing U.S. form may still live outside HPG Workspace. In that case,
  -- the policy remains valid and Finance/Development uses its configured URL.
  if v_jurisdiction = 'international' and v_form_id is null then
    raise exception 'International NGO activation fee form template is missing';
  end if;

  update public.case_registry
  set applicant_country = v_country,
      jurisdiction_class = v_jurisdiction,
      activation_fee_policy_key = v_policy.policy_key,
      activation_fee_amount_cents = v_policy.amount_cents,
      activation_fee_currency = v_policy.currency,
      activation_fee_form_template_id = v_form_id,
      next_action = case
        when v_jurisdiction = 'us_domestic' then 'Send the existing U.S. NGO onboarding fee form.'
        else 'Send the International NGO Activation Fee Form for $100 USD.'
      end,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'activation_fee_routed_at', now(),
        'activation_fee_policy_key', v_policy.policy_key,
        'jurisdiction_class', v_jurisdiction,
        'country', v_country
      ),
      updated_at = now()
  where id = p_case_id
  returning * into v_case;

  if v_case.ngo_id is not null then
    update public.ngos
    set jurisdiction_class = v_jurisdiction,
        activation_fee_policy_key = v_policy.policy_key,
        activation_fee_amount_cents = v_policy.amount_cents,
        activation_fee_currency = v_policy.currency,
        activation_fee_form_template_id = v_form_id,
        updated_at = now()
    where id = v_case.ngo_id;
  end if;

  return v_case;
end;
$$;

create or replace function public.agent_os_verify_activation_fee(
  p_case_id uuid,
  p_payment_reference text,
  p_verified_at timestamptz default now()
)
returns public.case_registry
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case public.case_registry;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_internal_user() then
    raise exception 'Internal HPG Finance authority is required to verify an activation fee';
  end if;

  select * into v_case
  from public.case_registry
  where id = p_case_id
  for update;

  if not found then
    raise exception 'Agent OS case not found';
  end if;

  if v_case.activation_fee_policy_key is null then
    raise exception 'Activation fee routing must be completed before payment verification';
  end if;

  if nullif(btrim(coalesce(p_payment_reference,'')), '') is null then
    raise exception 'A payment or transaction reference is required';
  end if;

  update public.case_registry
  set activation_fee_verified_at = coalesce(p_verified_at, now()),
      activation_fee_payment_reference = btrim(p_payment_reference),
      next_action = 'Issue the HPG confirmation letter.',
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'activation_fee_verified_by', auth.uid(),
        'activation_fee_verified_at', coalesce(p_verified_at, now()),
        'activation_fee_payment_reference', btrim(p_payment_reference)
      ),
      updated_at = now()
  where id = p_case_id
  returning * into v_case;

  if v_case.ngo_id is not null then
    update public.ngos
    set activation_fee_verified_at = v_case.activation_fee_verified_at,
        activation_fee_payment_reference = v_case.activation_fee_payment_reference,
        onboarding_fee_verified_at = case
          when v_case.jurisdiction_class = 'us_domestic' then v_case.activation_fee_verified_at
          else onboarding_fee_verified_at
        end,
        updated_at = now()
    where id = v_case.ngo_id;
  end if;

  return v_case;
end;
$$;

create or replace function public.agent_os_activation_fee_stage_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.case_type = 'sponsorship'
     and new.workflow_stage is distinct from old.workflow_stage then

    if new.workflow_stage = 'onboarding_fee_form_sent'
       and new.activation_fee_policy_key is null then
      raise exception 'Route the jurisdiction-specific activation fee form before marking it sent';
    end if;

    if new.workflow_stage = 'confirmation_letter_issued'
       and new.activation_fee_verified_at is null then
      raise exception 'Finance must verify the applicable activation fee before the confirmation letter is issued';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists case_registry_activation_fee_stage_guard on public.case_registry;
create trigger case_registry_activation_fee_stage_guard
before update of workflow_stage on public.case_registry
for each row execute function public.agent_os_activation_fee_stage_guard();

create or replace function public.agent_os_route_fee_after_agreement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.case_type = 'sponsorship'
     and new.workflow_stage = 'agreement_signed'
     and new.workflow_stage is distinct from old.workflow_stage then
    perform public.agent_os_route_activation_fee(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists case_registry_route_fee_after_agreement on public.case_registry;
create trigger case_registry_route_fee_after_agreement
after update of workflow_stage on public.case_registry
for each row execute function public.agent_os_route_fee_after_agreement();

update public.agent_os_workflow_stages
set stage_name = 'Jurisdiction-Specific Activation Fee Form Sent',
    responsible_role = 'Development Executive Secretary',
    updated_at = now()
where workflow_type = 'sponsorship' and stage_key = 'onboarding_fee_form_sent';

update public.agent_os_workflow_stages
set stage_name = 'Activation Fee Payment Pending',
    responsible_role = 'Finance Department',
    updated_at = now()
where workflow_type = 'sponsorship' and stage_key = 'onboarding_fee_payment_pending';

alter table public.agent_os_activation_fee_policies enable row level security;

create policy "Internal users can read Agent OS activation fee policies"
  on public.agent_os_activation_fee_policies for select to authenticated
  using (public.is_internal_user());

create policy "Super admins can manage Agent OS activation fee policies"
  on public.agent_os_activation_fee_policies for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

grant select on public.agent_os_activation_fee_policies to authenticated;
grant all on public.agent_os_activation_fee_policies to service_role;

revoke all on function public.agent_os_route_activation_fee(uuid) from public, anon;
grant execute on function public.agent_os_route_activation_fee(uuid) to authenticated, service_role;

revoke all on function public.agent_os_verify_activation_fee(uuid,text,timestamptz) from public, anon;
grant execute on function public.agent_os_verify_activation_fee(uuid,text,timestamptz) to authenticated, service_role;

comment on table public.agent_os_activation_fee_policies
  is 'Jurisdiction-specific fee routing. U.S. NGOs use the existing domestic onboarding form; non-U.S. NGOs use the dedicated fixed $100 USD international activation form.';

comment on function public.agent_os_route_activation_fee(uuid)
  is 'Classifies an NGO as U.S. or international after agreement signature and assigns the correct fee policy and form without sending it.';

comment on function public.agent_os_verify_activation_fee(uuid,text,timestamptz)
  is 'Records Finance verification of the jurisdiction-specific activation fee and unlocks confirmation-letter issuance.';
