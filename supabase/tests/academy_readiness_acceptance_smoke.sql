-- Security preflight for the Academy readiness and final acceptance ledger.
do $$
begin
  if not coalesce((select relrowsecurity from pg_class
    where oid='public.academy_training_acceptance'::regclass),false) then
    raise exception 'Staff acceptance evidence must have RLS';
  end if;
  if has_table_privilege('anon','public.academy_training_acceptance','SELECT')
    or has_table_privilege('authenticated','public.academy_training_acceptance','INSERT')
    or has_table_privilege('authenticated','public.academy_training_acceptance','UPDATE')
    or has_table_privilege('authenticated','public.academy_training_acceptance','DELETE') then
    raise exception 'Acceptances must be append-only through authorized review RPC';
  end if;
  if has_function_privilege('anon','public.record_academy_training_acceptance(text,uuid,text,text)','EXECUTE')
    or has_function_privilege('anon','public.get_academy_training_readiness()','EXECUTE') then
    raise exception 'Anonymous users must not access internal acceptance and readiness records';
  end if;
  if not has_function_privilege('authenticated','public.record_academy_training_acceptance(text,uuid,text,text)','EXECUTE') then
    raise exception 'Authorized administrators cannot reach the acceptance review endpoint';
  end if;
end $$;
do $$
declare count_rows integer;
begin
  begin
    perform * from public.get_academy_training_readiness();
    raise exception 'Unauthenticated visitor unexpectedly viewed readiness';
  exception when others then
    if sqlerrm not like '%administrator access%' then raise; end if;
  end;
  begin
    perform public.record_academy_training_acceptance(
      'welcome',gen_random_uuid(),'passed','Fictional evidence must never be accepted');
    raise exception 'Unauthenticated visitor created a test acceptance';
  exception when others then
    if sqlerrm not like '%Authorized Academy administrator required%' then raise; end if;
  end;
  select count(*) into count_rows from public.academy_training_acceptance;
  if count_rows>0 then
    raise exception 'The training project should not fabricate role acceptance rows during migration';
  end if;
end $$;
select 'academy_readiness_acceptance_security_passed' as result;
