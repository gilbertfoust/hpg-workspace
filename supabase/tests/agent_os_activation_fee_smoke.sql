\set ON_ERROR_STOP on

begin;

-- Execute security-definer routing functions as the service role used by
-- backend Agent OS workers.
select set_config('request.jwt.claim.role', 'service_role', true);

insert into public.case_registry (
  reference_number,
  case_type,
  organization_name,
  primary_email,
  workflow_stage,
  status,
  metadata
) values
  (
    'TEST-US-NGO-0001',
    'sponsorship',
    'Domestic Test NGO',
    'domestic@example.invalid',
    'agreement_signed',
    'open',
    jsonb_build_object('country', 'United States')
  ),
  (
    'TEST-INT-NGO-0001',
    'sponsorship',
    'International Test NGO',
    'international@example.invalid',
    'agreement_signed',
    'open',
    jsonb_build_object('country', 'Kenya')
  );

select public.agent_os_route_activation_fee(id)
from public.case_registry
where reference_number in ('TEST-US-NGO-0001', 'TEST-INT-NGO-0001');

do $$
declare
  v_us public.case_registry;
  v_international public.case_registry;
begin
  select * into v_us
  from public.case_registry
  where reference_number = 'TEST-US-NGO-0001';

  if v_us.jurisdiction_class <> 'us_domestic' then
    raise exception 'Expected U.S. case to route to us_domestic, received %', v_us.jurisdiction_class;
  end if;

  if v_us.activation_fee_policy_key <> 'us_ngo_onboarding_fee' then
    raise exception 'Expected U.S. onboarding fee policy, received %', v_us.activation_fee_policy_key;
  end if;

  if v_us.activation_fee_amount_cents is not null then
    raise exception 'U.S. fee amount must remain controlled by existing Finance configuration';
  end if;

  select * into v_international
  from public.case_registry
  where reference_number = 'TEST-INT-NGO-0001';

  if v_international.jurisdiction_class <> 'international' then
    raise exception 'Expected international case routing, received %', v_international.jurisdiction_class;
  end if;

  if v_international.activation_fee_policy_key <> 'international_ngo_activation_fee' then
    raise exception 'Expected international activation fee policy, received %', v_international.activation_fee_policy_key;
  end if;

  if v_international.activation_fee_amount_cents <> 10000
     or v_international.activation_fee_currency <> 'USD' then
    raise exception 'International fee must be fixed at $100 USD';
  end if;

  if v_international.activation_fee_form_template_id is null then
    raise exception 'International activation fee form template was not linked';
  end if;
end $$;

-- Replacing an unsent invitation must cancel its queued communication so an
-- expired/revoked link cannot be delivered later.
do $$
declare
  v_case public.case_registry;
  v_invitation_id uuid := gen_random_uuid();
  v_communication_status text;
begin
  select * into v_case
  from public.case_registry
  where reference_number = 'TEST-INT-NGO-0001';

  insert into public.agent_os_external_form_invitations (
    id,
    token_hash,
    case_registry_id,
    form_template_id,
    recipient_email,
    status,
    expires_at
  ) values (
    v_invitation_id,
    repeat('a', 64),
    v_case.id,
    v_case.activation_fee_form_template_id,
    'international@example.invalid',
    'pending',
    now() + interval '14 days'
  );

  insert into public.communication_queue (
    idempotency_key,
    case_registry_id,
    communication_type,
    authority_level,
    channel,
    recipient_address,
    subject,
    body,
    status,
    source_context
  ) values (
    'TEST-INVITATION-COMMUNICATION',
    v_case.id,
    'international_activation_fee_form',
    'automatic',
    'email',
    'international@example.invalid',
    'Test international activation invitation',
    'Test secure form link',
    'pending',
    jsonb_build_object('invitation_id', v_invitation_id)
  );

  update public.agent_os_external_form_invitations
  set status = 'revoked', revoked_at = now()
  where id = v_invitation_id;

  select status into v_communication_status
  from public.communication_queue
  where idempotency_key = 'TEST-INVITATION-COMMUNICATION';

  if v_communication_status <> 'cancelled' then
    raise exception 'Revoked invitation communication should be cancelled, received %', v_communication_status;
  end if;
end $$;

-- The confirmation letter must remain blocked before Finance verification.
do $$
declare
  v_case_id uuid;
begin
  select id into v_case_id
  from public.case_registry
  where reference_number = 'TEST-INT-NGO-0001';

  begin
    update public.case_registry
    set workflow_stage = 'confirmation_letter_issued'
    where id = v_case_id;

    raise exception 'Expected confirmation-letter guard to block the transition';
  exception
    when others then
      if position('Finance must verify' in sqlerrm) = 0 then
        raise;
      end if;
  end;
end $$;

select public.agent_os_verify_activation_fee(
  id,
  'TEST-PAYMENT-REFERENCE',
  now()
)
from public.case_registry
where reference_number = 'TEST-INT-NGO-0001';

update public.case_registry
set workflow_stage = 'confirmation_letter_issued'
where reference_number = 'TEST-INT-NGO-0001';

do $$
declare
  v_case public.case_registry;
begin
  select * into v_case
  from public.case_registry
  where reference_number = 'TEST-INT-NGO-0001';

  if v_case.activation_fee_verified_at is null then
    raise exception 'Finance verification timestamp was not recorded';
  end if;

  if v_case.activation_fee_payment_reference <> 'TEST-PAYMENT-REFERENCE' then
    raise exception 'Finance payment reference was not recorded';
  end if;

  if v_case.workflow_stage <> 'confirmation_letter_issued' then
    raise exception 'Verified case did not advance to confirmation-letter stage';
  end if;
end $$;

rollback;
