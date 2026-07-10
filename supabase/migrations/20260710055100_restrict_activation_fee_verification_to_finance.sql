-- Restrict payment verification to HPG Finance authority while preserving
-- service-role execution for controlled backend workers and smoke tests.

create or replace function public.agent_os_has_finance_authority()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(auth.role(), '') = 'service_role'
    or exists (
      select 1
      from public.profiles p
      left join public.departments d on d.id = p.department_id
      where p.id = auth.uid()
        and (
          p.role in ('super_admin', 'vp_finance')
          or (
            d.name = 'Finance'
            and p.role in ('department_lead', 'staff', 'staff_member')
          )
        )
    )
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role::text in ('super_admin', 'vp_finance')
    );
$$;

revoke all on function public.agent_os_has_finance_authority() from public, anon;
grant execute on function public.agent_os_has_finance_authority() to authenticated, service_role;

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
  if not public.agent_os_has_finance_authority() then
    raise exception 'HPG Finance authority is required to verify an activation fee';
  end if;

  select * into v_case
  from public.case_registry
  where id = p_case_id
  for update;

  if not found then
    raise exception 'Agent OS case not found';
  end if;

  if v_case.case_type <> 'sponsorship' then
    raise exception 'Activation fee verification is only valid for sponsorship cases';
  end if;

  if v_case.activation_fee_policy_key is null then
    raise exception 'Activation fee routing must be completed before payment verification';
  end if;

  if v_case.activation_fee_verified_at is not null then
    return v_case;
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

  insert into public.agent_runs (
    run_key,
    agent_name,
    agent_role,
    case_registry_id,
    trigger_type,
    status,
    confidence,
    systems_consulted,
    sources_used,
    action_attempted,
    approval_required,
    records_changed,
    result_summary,
    completed_at,
    metadata
  ) values (
    'activation-fee-verification:' || p_case_id::text,
    'HPG Finance Verification',
    'Human Financial Control',
    p_case_id,
    'human_finance_verification',
    'completed',
    'high',
    jsonb_build_array('case_registry', 'ngos'),
    jsonb_build_array(jsonb_build_object('payment_reference_recorded', true)),
    'Verify jurisdiction-specific NGO activation fee payment',
    true,
    jsonb_build_array(
      jsonb_build_object('table', 'case_registry', 'id', p_case_id),
      jsonb_build_object('table', 'ngos', 'id', v_case.ngo_id)
    ),
    'HPG Finance recorded payment verification; confirmation-letter gate is unlocked.',
    now(),
    jsonb_build_object(
      'verified_by_user_id', auth.uid(),
      'jurisdiction_class', v_case.jurisdiction_class,
      'policy_key', v_case.activation_fee_policy_key,
      'currency', v_case.activation_fee_currency,
      'amount_cents', v_case.activation_fee_amount_cents
    )
  )
  on conflict (run_key) do update set
    status = excluded.status,
    result_summary = excluded.result_summary,
    completed_at = excluded.completed_at,
    metadata = excluded.metadata;

  return v_case;
end;
$$;

revoke all on function public.agent_os_verify_activation_fee(uuid,text,timestamptz) from public, anon;
grant execute on function public.agent_os_verify_activation_fee(uuid,text,timestamptz) to authenticated, service_role;

comment on function public.agent_os_has_finance_authority()
  is 'Returns true only for the service role, super administrators, VP Finance, or Finance department leads/staff.';

comment on function public.agent_os_verify_activation_fee(uuid,text,timestamptz)
  is 'Finance-only payment verification that records an audit run and unlocks confirmation-letter issuance.';
