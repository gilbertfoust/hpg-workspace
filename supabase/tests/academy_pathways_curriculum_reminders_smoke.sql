-- Phases 1-4, read-only permission and curriculum smoke.
do $$
declare t text;
begin
  foreach t in array array[
    'academy_pathway_rules','academy_course_assignments',
    'academy_assignment_events','academy_course_syllabi',
    'academy_lesson_standards','academy_curriculum_audit',
    'academy_assessment_policies','academy_remediation_plans',
    'academy_course_notifications'
  ] loop
    if not coalesce((select relrowsecurity from pg_class
      where oid=('public.'||t)::regclass),false) then
      raise exception 'RLS absent on %',t;
    end if;
    if has_table_privilege('anon','public.'||t,'SELECT')
      or has_table_privilege('authenticated','public.'||t,'INSERT')
      or has_table_privilege('authenticated','public.'||t,'UPDATE')
      or has_table_privilege('authenticated','public.'||t,'DELETE') then
      raise exception 'Direct unauthorized Academy mutations or anonymous reads on %',t;
    end if;
  end loop;
  if (select count(*) from public.academy_pathway_rules)<>15
    or (select count(*) from public.academy_course_syllabi)<>15
    or (select count(*) from public.academy_lesson_standards)<>60
    or (select count(*) from public.academy_assessment_policies)<>15 then
    raise exception 'Incomplete internal course catalog or assessment policies';
  end if;
  if exists(select 1 from public.academy_course_assignments a
    join public.profiles p on p.id=a.user_id
    where p.role in('external_ngo','external_portal','ngo_user')) then
    raise exception 'External organizations must never receive internal staff learning paths';
  end if;
  if not exists(select 1 from cron.job
    where jobname='hpg-academy-due-notices' and active) then
    raise exception 'Scheduled internal due alerts missing';
  end if;
  if has_function_privilege('anon','public.set_academy_course_assignment(uuid,text,text,boolean,timestamptz)','EXECUTE')
    or has_function_privilege('anon','public.get_team_academy_course_assignments()','EXECUTE')
    or has_function_privilege('anon','public.get_my_academy_learning_plan()','EXECUTE') then
    raise exception 'Anonymous role assignment or reporting endpoints exposed';
  end if;
end $$;

do $$
begin
  perform public.set_academy_course_assignment(gen_random_uuid(),'start','assigned',true,null);
  raise exception 'Unauthenticated administrator unexpectedly assigned training';
exception when others then
  if sqlerrm not like '%Academy administrator required%' then raise; end if;
end $$;
do $$
begin
  perform * from public.get_team_academy_course_assignments();
  raise exception 'Unauthenticated user unexpectedly viewed team learning paths';
exception when others then
  if sqlerrm not like '%Authorized internal supervisor required%' then raise; end if;
end $$;
select 'academy_phases_1_4_security_passed' as result;
