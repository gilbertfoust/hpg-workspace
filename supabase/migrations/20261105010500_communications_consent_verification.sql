-- Require independently reviewed Communications rights/consent decisions.
-- Staff can continue recording requirements and editing pending descriptions, but
-- cannot self-certify permission by editing status or evidence through the Data API.
-- Existing Communications editorial release checks use this verified status.

create or replace function private.guard_communications_consent_decision()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op='INSERT' then
    if new.status in ('granted','not_required') then
      raise exception 'Consent must be registered as pending and independently reviewed'
        using errcode='42501';
    end if;
    return new;
  end if;
  if (
    new.status is distinct from old.status
    or new.evidence_url is distinct from old.evidence_url
    or new.granted_at is distinct from old.granted_at
    or new.expires_at is distinct from old.expires_at
    or new.verified_by_user_id is distinct from old.verified_by_user_id
    or (old.status in ('granted','not_required')
        and (new.scope_notes is distinct from old.scope_notes
          or new.subject_reference is distinct from old.subject_reference
          or new.consent_type is distinct from old.consent_type))
  ) then
    if (select auth.uid()) is null
       or current_setting('hpg.communications_consent_decision',true) is distinct from 'true'
       or not (select public.is_communications_approver())
       or (select auth.uid())=old.created_by_user_id then
      raise exception 'Only an independent authorized reviewer may change a consent decision or evidence'
        using errcode='42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger require_communications_consent_review
before insert or update on public.communications_rights_consents
for each row execute function private.guard_communications_consent_decision();

-- Replace table-wide client UPDATE with pending-description-only updates.
-- Procedure owner keeps the privileges necessary to record review decisions.
revoke update on public.communications_rights_consents from public,anon,authenticated;
grant update (subject_reference,consent_type,scope_notes)
on public.communications_rights_consents to authenticated;

create or replace function public.decide_communications_consent(
  p_id uuid,
  p_decision text,
  p_evidence_url text,
  p_scope_notes text,
  p_expires_at timestamptz default null
) returns public.communications_rights_consents
language plpgsql security definer
set search_path = ''
as $$
declare
  current_record public.communications_rights_consents;
  decided public.communications_rights_consents;
begin
  if (select auth.uid()) is null or not (select public.is_communications_approver()) then
    raise exception 'Authorized Communications consent reviewer required' using errcode='42501';
  end if;
  if p_decision not in ('granted','not_required','declined','requested') then
    raise exception 'Unsupported consent decision' using errcode='22023';
  end if;
  if length(btrim(coalesce(p_scope_notes,'')))<10 then
    raise exception 'Describe the consent scope or reason in at least 10 characters' using errcode='23514';
  end if;
  if p_decision='granted' then
    if p_evidence_url is null or p_evidence_url !~* '^https://[^[:space:]]+$' then
      raise exception 'Granted permission requires a valid HTTPS evidence URL' using errcode='23514';
    end if;
    if p_expires_at is not null and p_expires_at<=now() then
      raise exception 'Permission expiration must be in the future' using errcode='23514';
    end if;
  elsif nullif(btrim(coalesce(p_evidence_url,'')),'') is not null
    and p_evidence_url !~* '^https://[^[:space:]]+$' then
    raise exception 'Evidence links must use HTTPS' using errcode='23514';
  end if;

  select * into current_record
  from public.communications_rights_consents where id=p_id for update;
  if not found then raise exception 'Consent record not found' using errcode='P0002'; end if;
  if current_record.created_by_user_id=(select auth.uid()) then
    raise exception 'An independent reviewer must decide permission; the registrant cannot self-approve'
      using errcode='42501';
  end if;
  if exists(
    select 1 from public.communications_editorial_items story
    where story.id=current_record.editorial_item_id
      and story.status in ('published','archived','canceled')
  ) then
    raise exception 'Published or archived editorial consent cannot be changed retroactively'
      using errcode='42501';
  end if;

  perform set_config('hpg.communications_consent_decision','true',true);
  update public.communications_rights_consents set
    status=p_decision,
    scope_notes=btrim(p_scope_notes),
    evidence_url=nullif(btrim(coalesce(p_evidence_url,'')),''),
    expires_at=case when p_decision='granted' then p_expires_at else null end,
    granted_at=case when p_decision='granted' then now() else null end,
    verified_by_user_id=(select auth.uid()),
    updated_at=now()
  where id=p_id
  returning * into decided;
  perform set_config('hpg.communications_consent_decision','false',true);

  insert into public.communications_events(
    entity_type,entity_id,event_type,actor_user_id,event_metadata
  ) values (
    'editorial_item',current_record.editorial_item_id,'consent_reviewed',(select auth.uid()),
    jsonb_build_object(
      'consent_id',p_id,'prior_status',current_record.status,
      'decision',p_decision,'evidence_recorded',nullif(btrim(coalesce(p_evidence_url,'')),'') is not null,
      'expires_at',decided.expires_at
    )
  );
  return decided;
end;
$$;

revoke all on function public.decide_communications_consent(uuid,text,text,text,timestamptz)
from public,anon,authenticated;
grant execute on function public.decide_communications_consent(uuid,text,text,text,timestamptz)
to authenticated;

comment on function public.decide_communications_consent(uuid,text,text,text,timestamptz)
is 'Independent reviewer decision with documented consent scope, HTTPS proof and immutable audit event.';
