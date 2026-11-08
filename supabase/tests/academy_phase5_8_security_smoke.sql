-- Phases 5-8: course-scoped access, real integration evidence and translation privacy.
-- This test is deliberately read-only; it never fabricates certificates,
-- instructor videos, staff validations, publications or language approvals.
do $$
declare t text;
begin
  foreach t in array array[
    'academy_lessons','academy_assessments','academy_course_syllabi',
    'academy_lesson_standards','academy_lesson_resources',
    'academy_lesson_translations','academy_translation_events'
  ] loop
    if not coalesce((select relrowsecurity from pg_class
      where oid=('public.'||t)::regclass),false) then
      raise exception 'Expected RLS on %',t;
    end if;
  end loop;
  if has_table_privilege('anon','public.academy_lesson_translations','SELECT')
    or has_table_privilege('authenticated','public.academy_lesson_translations','INSERT')
    or has_table_privilege('authenticated','public.academy_lesson_translations','UPDATE')
    or has_table_privilege('authenticated','public.academy_lesson_translations','DELETE') then
    raise exception 'Unreviewed Academy translations must not be directly publishable';
  end if;
  if has_function_privilege('anon','public.can_view_assigned_academy_track(text)','EXECUTE')
    or has_function_privilege('anon','public.can_record_assigned_academy_lesson(text)','EXECUTE')
    or has_function_privilege('anon','public.get_academy_integration_readiness()','EXECUTE')
    or has_function_privilege('anon','public.save_academy_lesson_translation(text,text,text,text,jsonb,text)','EXECUTE')
    or has_function_privilege('anon','public.review_academy_lesson_translation(text,text,text)','EXECUTE') then
    raise exception 'An anonymous caller can invoke restricted Academy operations';
  end if;
  if (select count(*) from public.academy_lessons)<>60 then
    raise exception 'All sixty authored Workspace Training lessons must remain registered';
  end if;
  if exists(select 1 from public.academy_course_assignments a
    join public.profiles p on p.id=a.user_id
    where p.role in('external_ngo','external_portal','ngo_user')) then
    raise exception 'External NGOs may not acquire internal staff courses';
  end if;
end $$;

do $$
begin
  if public.can_view_assigned_academy_track('hr') or
     public.can_record_assigned_academy_lesson('hr-directory') then
    raise exception 'Anonymous sessions cannot view or complete internal role courses';
  end if;
end $$;

do $$
begin
  perform public.get_academy_integration_readiness();
  raise exception 'Unauthenticated integration status was disclosed';
exception when others then
  if sqlerrm not like '%Internal Academy administrator required%' then raise; end if;
end $$;
do $$
begin
  perform public.save_academy_lesson_translation(
    'welcome','fr','Titre test','Objectif fictif dépassant vingt caractères',
    '["Un faux pas qui ne doit pas être enregistré"]'::jsonb,
    'Cette donnée fictive ne doit pas être enregistrée'
  );
  raise exception 'Unauthenticated translation author wrote Academy data';
exception when others then
  if sqlerrm not like '%Academy translation author requires administrator access%' then raise; end if;
end $$;

select 'academy_phase5_8_security_passed' as result;
