-- Read-only Academy expansion and private-media smoke assertions.
do $$
declare lesson_count integer;track_count integer;assessment_count integer;
  question_count integer;
begin
  select count(*) into lesson_count from public.academy_lessons;
  select count(distinct track_id) into track_count from public.academy_lessons;
  select count(*) into assessment_count from public.academy_assessments;
  select count(*) into question_count from private.academy_assessment_questions;
  if lesson_count<60 or track_count<15 then
    raise exception 'Workspace Training lesson expansion is incomplete: lessons %, tracks %',lesson_count,track_count;
  end if;
  if assessment_count<15 or question_count<99 then
    raise exception 'Academy knowledge check expansion is incomplete: assessments %, questions %',assessment_count,question_count;
  end if;
  if exists(select 1 from public.academy_assessments a where
    (select count(*) from private.academy_assessment_questions q where q.assessment_id=a.assessment_id)<5) then
    raise exception 'Every active Academy assessment should have at least five questions';
  end if;
  if not coalesce((select relrowsecurity from pg_class where oid='public.academy_lesson_resources'::regclass),false) then
    raise exception 'Academy resource metadata must have RLS';
  end if;
  if has_table_privilege('anon','public.academy_lesson_resources','SELECT')
    or has_table_privilege('authenticated','public.academy_lesson_resources','INSERT')
    or has_table_privilege('authenticated','public.academy_lesson_resources','UPDATE')
    or has_table_privilege('authenticated','public.academy_lesson_resources','DELETE') then
    raise exception 'Academy instructional media must use permissioned publication endpoints';
  end if;
  if has_function_privilege('anon','public.create_academy_lesson_resource(text,text,text,text,text,text,text)','EXECUTE')
    or has_function_privilege('anon','public.review_academy_lesson_resource(uuid,text)','EXECUTE') then
    raise exception 'Anonymous accounts may not create or publish instructional media';
  end if;
  if not has_function_privilege('authenticated','public.create_academy_lesson_resource(text,text,text,text,text,text,text)','EXECUTE')
    or not has_function_privilege('authenticated','public.review_academy_lesson_resource(uuid,text)','EXECUTE') then
    raise exception 'Authorized training admin endpoints are not callable';
  end if;
end $$;

do $$
begin
  perform public.review_academy_lesson_resource(gen_random_uuid(),'publish');
  raise exception 'Unauthenticated user unexpectedly published learning media';
exception when others then
  if sqlerrm not like '%Academy curriculum administrators only%' then raise; end if;
end $$;

do $$
begin
  perform public.create_academy_lesson_resource(
    'welcome','Unauthorized tutorial','guide','https://example.org/guide',
    null,'', 'en');
  raise exception 'Unauthenticated user unexpectedly created learning media';
exception when others then
  if sqlerrm not like '%Academy curriculum administrators only%' then raise; end if;
end $$;

select 'academy_workflow_expansion_security_passed' as result;
