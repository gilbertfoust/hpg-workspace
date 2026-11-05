-- Safe post-migration security assertions (no consent records created).
do $$
begin
  if has_column_privilege('authenticated','public.communications_rights_consents','status','UPDATE')
     or has_column_privilege('authenticated','public.communications_rights_consents','evidence_url','UPDATE')
     or has_column_privilege('authenticated','public.communications_rights_consents','verified_by_user_id','UPDATE') then
    raise exception 'Staff can self-approve consent by updating a protected field';
  end if;
  if not has_column_privilege('authenticated','public.communications_rights_consents','scope_notes','UPDATE') then
    raise exception 'Pending consent descriptions should remain editable by authorized staff';
  end if;
  if has_function_privilege('anon','public.decide_communications_consent(uuid,text,text,text,timestamptz)','EXECUTE') then
    raise exception 'Anonymous users can call consent decision';
  end if;
  if not has_function_privilege('authenticated','public.decide_communications_consent(uuid,text,text,timestamptz)','EXECUTE') then
    raise exception 'Authenticated reviewer RPC is not callable';
  end if;
  if not exists(
    select 1 from pg_trigger where tgrelid='public.communications_rights_consents'::regclass
    and tgname='require_communications_consent_review' and tgenabled<>'D'
  ) then raise exception 'Independent consent guard trigger missing'; end if;
end $$;

do $$
begin
  perform public.decide_communications_consent(gen_random_uuid(),'granted',
    'https://example.org/consent','Scope restricted to approved interview text',null);
  raise exception 'Unauthenticated consent reviewer unexpectedly succeeded';
exception when others then
  if sqlerrm not like '%Authorized Communications consent reviewer required%' then raise; end if;
end $$;

select 'communications_consent_review_security_passed' as result;
