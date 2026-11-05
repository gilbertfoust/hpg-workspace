-- Read-only schema and permission checks. No training attempts,
-- signatures, board motions or director votes are created by this test.
do $$
declare question_count integer;
begin
  if (select count(*) from public.academy_assessments where is_active)<8 then
    raise exception 'Incomplete Academy assessment catalog';
  end if;
  select count(*) into question_count from private.academy_assessment_questions;
  if question_count<24 then raise exception 'Assessment question bank incomplete'; end if;
  if not coalesce((select relrowsecurity from pg_class
      where oid='public.academy_assessment_attempts'::regclass),false) then
    raise exception 'Assessment results require RLS'; end if;
  if not coalesce((select relrowsecurity from pg_class
      where oid='public.academy_competency_signoffs'::regclass),false) then
    raise exception 'Supervisor endorsements require RLS'; end if;
  if has_table_privilege('anon','public.academy_assessment_attempts','SELECT')
    or has_table_privilege('anon','public.academy_competency_signoffs','SELECT') then
    raise exception 'Anonymous users can access assessment results'; end if;
  if has_table_privilege('authenticated','private.academy_assessment_questions','SELECT') then
    raise exception 'Answer keys are exposed to authenticated browsers'; end if;
  if has_table_privilege('authenticated','public.academy_assessment_attempts','INSERT')
    or has_table_privilege('authenticated','public.academy_competency_signoffs','INSERT')
    or has_table_privilege('authenticated','public.academy_competency_signoffs','UPDATE') then
    raise exception 'Authenticated clients could forge assessment results or signatures'; end if;
  if has_function_privilege('anon','public.submit_academy_assessment(text,jsonb)','EXECUTE')
    or has_function_privilege('anon','public.get_academy_assessment(text)','EXECUTE')
    or has_function_privilege('anon','public.signoff_academy_assessment(uuid,text,text,text)','EXECUTE')
    or has_function_privilege('anon','public.get_academy_assessment_team()','EXECUTE') then
    raise exception 'Anonymous assessment actions must be blocked'; end if;
  if not has_function_privilege('authenticated','public.submit_academy_assessment(text,jsonb)','EXECUTE')
    or not has_function_privilege('authenticated','public.signoff_academy_assessment(uuid,text,text,text)','EXECUTE') then
    raise exception 'Assessment RPC endpoints are not accessible to authenticated users'; end if;
end $$;
do $$
begin
  perform public.submit_academy_assessment('start','{}'::jsonb);
  raise exception 'Unauthenticated learner unexpectedly submitted an attempt';
exception when others then
  if sqlerrm not like '%Assessment unavailable for this learner%' then raise;end if;
end $$;
do $$
begin
  perform public.signoff_academy_assessment(gen_random_uuid(),'start','endorsed',
    'Reviewed observed knowledge check');
  raise exception 'Unauthenticated reviewer unexpectedly endorsed';
exception when others then
  if sqlerrm not like '%Authorized HPG supervisor required%' then raise;end if;
end $$;
do $$
declare team_rows int;
begin
  select count(*) into team_rows from public.get_academy_assessment_team();
  if team_rows>0 then raise exception 'Unauthenticated reviewer can see team knowledge checks';end if;
end $$;
select 'academy_assessment_signoff_security_passed' as result;
