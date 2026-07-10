-- Validation and routing controls for the International NGO Activation Fee Form.

update public.form_templates
set schema_json = jsonb_build_object(
      'fields', jsonb_build_array(
        jsonb_build_object('name','ngo_profile_number','type','text','label','HPG NGO Profile Number','required',true),
        jsonb_build_object('name','legal_organization_name','type','text','label','Legal Organization Name','required',true),
        jsonb_build_object('name','country','type','text','label','Country of Registration or Primary Operation','required',true),
        jsonb_build_object('name','authorized_representative','type','text','label','Authorized Representative','required',true),
        jsonb_build_object('name','billing_email','type','email','label','Billing Email','required',true),
        jsonb_build_object('name','fee_amount_usd','type','select','label','Activation Fee Amount','options',jsonb_build_array('$100 USD'),'required',true),
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
    updated_at = now()
where module = 'finance'::public.module_type
  and name = 'International NGO Activation Fee Form — $100 USD';

create or replace function public.agent_os_validate_activation_fee_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template_name text;
  v_country text;
  v_fee_value text;
  v_agreement_acknowledged boolean;
  v_accuracy_confirmed boolean;
begin
  select name into v_template_name
  from public.form_templates
  where id = new.form_template_id;

  if v_template_name <> 'International NGO Activation Fee Form — $100 USD' then
    return new;
  end if;

  -- Drafts may be incomplete. Validation applies only when the form is submitted.
  if lower(coalesce(new.submission_status, new.status, 'draft')) not in ('submitted','complete','completed') then
    return new;
  end if;

  v_fee_value := lower(regexp_replace(coalesce(new.payload_json->>'fee_amount_usd',''), '[^a-zA-Z0-9]', '', 'g'));
  if v_fee_value not in ('100usd','100') then
    raise exception 'The international NGO activation fee must be exactly $100 USD';
  end if;

  v_agreement_acknowledged := lower(coalesce(new.payload_json->>'agreement_acknowledgment','false')) = 'true';
  if not v_agreement_acknowledged then
    raise exception 'The signed-agreement acknowledgment is required';
  end if;

  v_accuracy_confirmed := lower(coalesce(new.payload_json->>'accuracy_confirmation','false')) = 'true';
  if not v_accuracy_confirmed then
    raise exception 'The accuracy and authorization certification is required';
  end if;

  if nullif(btrim(coalesce(new.payload_json->>'ngo_profile_number','')), '') is null then
    raise exception 'The HPG NGO profile number is required';
  end if;

  if new.ngo_id is not null then
    select country into v_country from public.ngos where id = new.ngo_id;
  else
    v_country := new.payload_json->>'country';
  end if;

  if nullif(btrim(coalesce(v_country,'')), '') is null then
    raise exception 'Country is required for international activation fee routing';
  end if;

  if public.agent_os_is_us_country(v_country) then
    raise exception 'A U.S. NGO cannot use the International NGO Activation Fee Form';
  end if;

  new.intake_status := 'new';
  new.routed_to_module := 'finance'::public.module_type;
  new.routed_module := 'finance'::public.module_type;
  new.audience := 'ngo_portal';

  return new;
end;
$$;

-- PostgreSQL does not permit INSERT OR UPDATE OF column-list in one trigger.
-- Keep insert and column-specific update triggers separate.
drop trigger if exists form_submissions_validate_international_activation_fee on public.form_submissions;
drop trigger if exists form_submissions_validate_international_activation_fee_insert on public.form_submissions;
drop trigger if exists form_submissions_validate_international_activation_fee_update on public.form_submissions;

create trigger form_submissions_validate_international_activation_fee_insert
before insert on public.form_submissions
for each row execute function public.agent_os_validate_activation_fee_submission();

create trigger form_submissions_validate_international_activation_fee_update
before update of payload_json, submission_status, status on public.form_submissions
for each row execute function public.agent_os_validate_activation_fee_submission();

create or replace function public.agent_os_after_activation_fee_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template_name text;
begin
  select name into v_template_name
  from public.form_templates
  where id = new.form_template_id;

  if v_template_name = 'International NGO Activation Fee Form — $100 USD'
     and lower(coalesce(new.submission_status, new.status, '')) in ('submitted','complete','completed') then
    update public.case_registry
    set next_action = 'Finance must verify the $100 USD international NGO activation payment.',
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'international_activation_fee_submission_id', new.id,
          'international_activation_fee_submitted_at', coalesce(new.submitted_at, now())
        ),
        updated_at = now()
    where ngo_id = new.ngo_id
      and case_type = 'sponsorship'
      and archived_at is null;
  end if;

  return new;
end;
$$;

drop trigger if exists form_submissions_after_international_activation_fee on public.form_submissions;
drop trigger if exists form_submissions_after_international_activation_fee_insert on public.form_submissions;
drop trigger if exists form_submissions_after_international_activation_fee_update on public.form_submissions;

create trigger form_submissions_after_international_activation_fee_insert
after insert on public.form_submissions
for each row execute function public.agent_os_after_activation_fee_submission();

create trigger form_submissions_after_international_activation_fee_update
after update of submission_status, status on public.form_submissions
for each row execute function public.agent_os_after_activation_fee_submission();

comment on function public.agent_os_validate_activation_fee_submission()
  is 'Rejects an incorrect amount or U.S.-NGO use of the dedicated international $100 activation form and routes valid submissions to Finance.';
