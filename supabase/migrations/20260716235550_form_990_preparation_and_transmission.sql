-- Form 990 preparation, validation, official-schema release tracking, and an
-- authorization-gated MeF transmission adapter. HPG cannot legally/technically
-- transmit production returns until its provider/EFIN/ETIN and ATS approval
-- are configured. 990-N remains an IRS-authenticated handoff because the IRS
-- does not publish a general third-party 990-N submission API.

create table public.tax_efile_provider_config (
  id uuid primary key default gen_random_uuid(),
  provider_name text not null,
  transmission_mode text not null check (transmission_mode in ('authorized_provider_api','irs_a2a','irs_ifa','manual_handoff')),
  efin text,
  etin text,
  ats_approved boolean not null default false,
  production_enabled boolean not null default false,
  supported_forms text[] not null default array['990']::text[],
  supported_tax_years integer[] not null default '{}'::integer[],
  credential_secret_reference text,
  configured_by_user_id uuid references public.profiles(id) on delete set null,
  configured_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tax_form_990_returns (
  id uuid primary key default gen_random_uuid(),
  ngo_id uuid not null references public.ngos(id) on delete restrict,
  tax_year integer not null check (tax_year between 2000 and 2200),
  form_type text not null check (form_type in ('990-N','990-EZ','990','990-PF')),
  filing_type text not null default 'original' check (filing_type in ('original','amended','final','short_period')),
  period_start date not null,
  period_end date not null,
  gross_receipts numeric(18,2) not null default 0,
  assets_end_of_year numeric(18,2),
  legal_name text not null,
  ein text not null,
  entity_json jsonb not null default '{}'::jsonb,
  answers_json jsonb not null default '{}'::jsonb,
  ledger_snapshot_json jsonb not null default '{}'::jsonb,
  irs_schema_version text,
  status text not null default 'draft' check (
    status in ('draft','validation_failed','ready_for_export','awaiting_authorization','queued','transmitted','accepted','rejected','amended','withdrawn')
  ),
  validation_summary jsonb not null default '{}'::jsonb,
  prepared_by_user_id uuid references public.profiles(id) on delete set null,
  reviewed_by_user_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  signed_by_user_id uuid references public.profiles(id) on delete set null,
  signed_at timestamptz,
  provider_config_id uuid references public.tax_efile_provider_config(id) on delete set null,
  provider_submission_id text,
  transmitted_at timestamptz,
  accepted_at timestamptz,
  rejection_code text,
  rejection_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(ngo_id,tax_year,form_type,filing_type),
  check(period_end >= period_start),
  check(ein ~ '^[0-9]{2}-?[0-9]{7}$')
);

create table public.tax_form_990_sections (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.tax_form_990_returns(id) on delete cascade,
  section_key text not null,
  section_label text not null,
  data_json jsonb not null default '{}'::jsonb,
  source text not null default 'manual' check (source in ('manual','ledger','ngo_profile','imported')),
  completed boolean not null default false,
  updated_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(return_id,section_key)
);

create table public.tax_form_990_validations (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.tax_form_990_returns(id) on delete cascade,
  validation_run_id uuid not null,
  rule_code text not null,
  severity text not null check (severity in ('error','warning','info')),
  section_key text,
  message text not null,
  irs_business_rule_reference text,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.tax_form_990_artifacts (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.tax_form_990_returns(id) on delete cascade,
  artifact_type text not null check (artifact_type in ('preparation_json','review_pdf','mef_xml','acknowledgment','rejection','acceptance')),
  document_id uuid references public.documents(id) on delete set null,
  sha256 text,
  schema_version text,
  is_official_transmission_artifact boolean not null default false,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.tax_form_990_transmission_events (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.tax_form_990_returns(id) on delete cascade,
  provider_event_id text,
  event_type text not null,
  status text,
  payload_json jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now()
);
create unique index tax_form_990_provider_event_unique on public.tax_form_990_transmission_events(provider_event_id) where provider_event_id is not null;
create index tax_form_990_returns_queue_idx on public.tax_form_990_returns(status,tax_year,ngo_id);
create index tax_form_990_validations_return_idx on public.tax_form_990_validations(return_id,validation_run_id,severity);

create trigger tax_efile_provider_config_updated_at before update on public.tax_efile_provider_config for each row execute function public.update_updated_at_column();
create trigger tax_form_990_returns_updated_at before update on public.tax_form_990_returns for each row execute function public.update_updated_at_column();
create trigger tax_form_990_sections_updated_at before update on public.tax_form_990_sections for each row execute function public.update_updated_at_column();

alter table public.tax_efile_provider_config enable row level security;
alter table public.tax_form_990_returns enable row level security;
alter table public.tax_form_990_sections enable row level security;
alter table public.tax_form_990_validations enable row level security;
alter table public.tax_form_990_artifacts enable row level security;
alter table public.tax_form_990_transmission_events enable row level security;

create policy "Finance manages efile provider configuration" on public.tax_efile_provider_config for all to authenticated
  using (public.is_finance_ledger_manager()) with check (public.is_finance_ledger_manager());
create policy "Finance and NGO approvers read 990 returns" on public.tax_form_990_returns for select to authenticated
  using (public.is_finance_staff() or public.has_ngo_finance_access(ngo_id,'approver'));
create policy "Finance reads 990 sections" on public.tax_form_990_sections for select to authenticated
  using (exists(select 1 from public.tax_form_990_returns r where r.id=return_id and (public.is_finance_staff() or public.has_ngo_finance_access(r.ngo_id,'approver'))));
create policy "Finance reads 990 validations" on public.tax_form_990_validations for select to authenticated
  using (exists(select 1 from public.tax_form_990_returns r where r.id=return_id and (public.is_finance_staff() or public.has_ngo_finance_access(r.ngo_id,'approver'))));
create policy "Finance reads 990 artifacts" on public.tax_form_990_artifacts for select to authenticated
  using (exists(select 1 from public.tax_form_990_returns r where r.id=return_id and (public.is_finance_staff() or public.has_ngo_finance_access(r.ngo_id,'approver'))));
create policy "Finance reads 990 transmission events" on public.tax_form_990_transmission_events for select to authenticated
  using (exists(select 1 from public.tax_form_990_returns r where r.id=return_id and public.is_finance_staff()));

revoke all on public.tax_efile_provider_config,public.tax_form_990_returns,public.tax_form_990_sections,
  public.tax_form_990_validations,public.tax_form_990_artifacts,public.tax_form_990_transmission_events from anon,authenticated;
grant select on public.tax_efile_provider_config,public.tax_form_990_returns,public.tax_form_990_sections,
  public.tax_form_990_validations,public.tax_form_990_artifacts,public.tax_form_990_transmission_events to authenticated;
grant all on public.tax_efile_provider_config,public.tax_form_990_returns,public.tax_form_990_sections,
  public.tax_form_990_validations,public.tax_form_990_artifacts,public.tax_form_990_transmission_events to service_role;

create or replace function public.create_form_990_return(
  p_ngo_id uuid,
  p_tax_year integer,
  p_gross_receipts numeric,
  p_assets_end_of_year numeric,
  p_legal_name text,
  p_ein text,
  p_force_full_990 boolean default false,
  p_990n_ineligible boolean default false
)
returns public.tax_form_990_returns
language plpgsql
security definer
set search_path=public
as $$
declare row_out public.tax_form_990_returns; selected_form text; normalized_ein text;
begin
  if auth.uid() is null or not public.is_finance_staff() then raise exception 'Finance access required'; end if;
  if not exists(select 1 from public.ngos where id=p_ngo_id) then raise exception 'NGO not found'; end if;
  if coalesce(p_gross_receipts,0)<0 or coalesce(p_assets_end_of_year,0)<0 then raise exception 'Financial values cannot be negative'; end if;
  normalized_ein:=regexp_replace(coalesce(p_ein,''),'[^0-9]','','g');
  if length(normalized_ein)<>9 then raise exception 'A valid nine-digit EIN is required'; end if;
  selected_form:=case when not p_force_full_990 and not p_990n_ineligible and coalesce(p_gross_receipts,0)<=50000 then '990-N' else '990' end;
  insert into public.tax_form_990_returns(
    ngo_id,tax_year,form_type,period_start,period_end,gross_receipts,assets_end_of_year,
    legal_name,ein,entity_json,irs_schema_version,prepared_by_user_id
  ) values (
    p_ngo_id,p_tax_year,selected_form,make_date(p_tax_year,1,1),make_date(p_tax_year,12,31),
    round(coalesce(p_gross_receipts,0),2),round(coalesce(p_assets_end_of_year,0),2),trim(p_legal_name),
    substr(normalized_ein,1,2)||'-'||substr(normalized_ein,3),
    jsonb_build_object('legal_name',trim(p_legal_name),'ein',substr(normalized_ein,1,2)||'-'||substr(normalized_ein,3)),
    case when p_tax_year=2025 and selected_form='990' then '2025v4.2' else null end,
    auth.uid()
  ) on conflict(ngo_id,tax_year,form_type,filing_type) do update set
    gross_receipts=excluded.gross_receipts,assets_end_of_year=excluded.assets_end_of_year,
    legal_name=excluded.legal_name,ein=excluded.ein,entity_json=excluded.entity_json,updated_at=now()
  returning * into row_out;
  insert into public.tax_form_990_sections(return_id,section_key,section_label,source)
  select row_out.id,key,label,source from (values
    ('organization','Organization information','ngo_profile'),
    ('revenue','Revenue','ledger'),('expenses','Functional expenses','ledger'),
    ('balance_sheet','Balance sheet','ledger'),('governance','Governance and management','manual'),
    ('program_service','Program service accomplishments','manual'),('compensation','Compensation','manual'),
    ('other_schedules','Required schedules','manual'),('signature','Officer signature','manual')
  ) section(key,label,source)
  on conflict(return_id,section_key) do nothing;
  return row_out;
end;
$$;

create or replace function public.save_form_990_section(
  p_return_id uuid,p_section_key text,p_data jsonb,p_completed boolean default false
)
returns public.tax_form_990_sections
language plpgsql
security definer
set search_path=public
as $$
declare row_out public.tax_form_990_sections;
begin
  if auth.uid() is null or not public.is_finance_staff() then raise exception 'Finance access required'; end if;
  update public.tax_form_990_sections set data_json=coalesce(p_data,'{}'::jsonb),completed=p_completed,updated_by_user_id=auth.uid()
  where return_id=p_return_id and section_key=p_section_key returning * into row_out;
  if row_out.id is null then raise exception 'Form 990 section not found'; end if;
  update public.tax_form_990_returns set status='draft' where id=p_return_id and status in ('validation_failed','ready_for_export','awaiting_authorization');
  return row_out;
end;
$$;

create or replace function public.validate_form_990_return(p_return_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare row_in public.tax_form_990_returns; run_id uuid:=gen_random_uuid(); errors integer:=0; warnings integer:=0; incomplete integer:=0; result jsonb;
begin
  select * into row_in from public.tax_form_990_returns where id=p_return_id;
  if row_in.id is null or not (public.is_finance_staff() or public.has_ngo_finance_access(row_in.ngo_id,'approver')) then raise exception 'Return access required'; end if;
  if row_in.form_type='990-N' and row_in.gross_receipts>50000 then
    insert into public.tax_form_990_validations(return_id,validation_run_id,rule_code,severity,message,irs_business_rule_reference)
    values(row_in.id,run_id,'HPG-990N-001','error','Gross receipts exceed the normal $50,000 Form 990-N threshold.','Form 990-N eligibility'); errors:=errors+1;
  end if;
  if row_in.form_type='990' then
    select count(*) into incomplete from public.tax_form_990_sections where return_id=row_in.id and not completed and section_key not in ('other_schedules');
    if incomplete>0 then
      insert into public.tax_form_990_validations(return_id,validation_run_id,rule_code,severity,message)
      values(row_in.id,run_id,'HPG-990-SECTION','error',incomplete||' required Form 990 sections are incomplete.'); errors:=errors+1;
    end if;
    if row_in.irs_schema_version is null then
      insert into public.tax_form_990_validations(return_id,validation_run_id,rule_code,severity,message)
      values(row_in.id,run_id,'HPG-MEF-SCHEMA','error','Select the IRS production schema release for this tax year before export.'); errors:=errors+1;
    end if;
  end if;
  if row_in.gross_receipts=0 then
    insert into public.tax_form_990_validations(return_id,validation_run_id,rule_code,severity,message)
    values(row_in.id,run_id,'HPG-RECEIPTS-ZERO','warning','Gross receipts are zero. Confirm this is correct.'); warnings:=warnings+1;
  end if;
  result:=jsonb_build_object('run_id',run_id,'errors',errors,'warnings',warnings,'passed',errors=0,'validated_at',now());
  update public.tax_form_990_returns set validation_summary=result,status=case when errors=0 then 'ready_for_export' else 'validation_failed' end where id=row_in.id;
  return result;
end;
$$;

create or replace function public.prepare_form_990_filing(p_return_id uuid)
returns public.tax_form_990_returns
language plpgsql
security definer
set search_path=public
as $$
declare row_out public.tax_form_990_returns; validation jsonb; config public.tax_efile_provider_config;
begin
  if auth.uid() is null or not public.is_finance_ledger_manager() then raise exception 'Finance manager access required'; end if;
  validation:=public.validate_form_990_return(p_return_id);
  if not coalesce((validation->>'passed')::boolean,false) then raise exception 'Resolve Form 990 validation errors before filing'; end if;
  select * into row_out from public.tax_form_990_returns where id=p_return_id for update;
  if row_out.form_type='990-N' then
    update public.tax_form_990_returns set status='ready_for_export',reviewed_by_user_id=auth.uid(),reviewed_at=now() where id=p_return_id returning * into row_out;
  else
    select * into config from public.tax_efile_provider_config
    where production_enabled and ats_approved and row_out.form_type=any(supported_forms) and row_out.tax_year=any(supported_tax_years)
    order by configured_at desc nulls last limit 1;
    update public.tax_form_990_returns set provider_config_id=config.id,
      status=case when config.id is null then 'awaiting_authorization' else 'queued' end,
      reviewed_by_user_id=auth.uid(),reviewed_at=now()
    where id=p_return_id returning * into row_out;
    if config.id is not null then
      insert into public.tax_form_990_transmission_events(return_id,event_type,status,payload_json)
      values(row_out.id,'queued','queued',jsonb_build_object('provider',config.provider_name,'schema_version',row_out.irs_schema_version));
    end if;
  end if;
  return row_out;
end;
$$;

revoke all on function public.create_form_990_return(uuid,integer,numeric,numeric,text,text,boolean,boolean) from public,anon;
revoke all on function public.save_form_990_section(uuid,text,jsonb,boolean) from public,anon;
revoke all on function public.validate_form_990_return(uuid) from public,anon;
revoke all on function public.prepare_form_990_filing(uuid) from public,anon;
grant execute on function public.create_form_990_return(uuid,integer,numeric,numeric,text,text,boolean,boolean) to authenticated;
grant execute on function public.save_form_990_section(uuid,text,jsonb,boolean) to authenticated;
grant execute on function public.validate_form_990_return(uuid) to authenticated;
grant execute on function public.prepare_form_990_filing(uuid) to authenticated;

comment on table public.tax_form_990_returns is 'Form 990/990-N workspace preparation record. Production MeF transmission remains authorization and ATS gated.';
