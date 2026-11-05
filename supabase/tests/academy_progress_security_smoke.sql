-- Non-destructive security checks for self-reported Academy learning history.
do $$
declare catalog_count integer;
begin
  select count(*) into catalog_count from public.academy_lessons;
  if catalog_count < 32 then raise exception 'Current authored lesson catalog is incomplete'; end if;
  if not coalesce((select relrowsecurity from pg_class
    where oid='public.academy_lesson_progress'::regclass),false) then
    raise exception 'Learning progress requires row-level security';
  end if;
  if not coalesce((select relrowsecurity from pg_class
    where oid='public.academy_lessons'::regclass),false) then
    raise exception 'Authored lesson catalog requires row-level security';
  end if;
  if has_table_privilege('anon','public.academy_lesson_progress','SELECT')
    or has_table_privilege('anon','public.academy_lesson_progress','INSERT')
    or has_table_privilege('anon','public.academy_lesson_progress','DELETE') then
    raise exception 'Anonymous accounts must not read or change training data';
  end if;
  if has_column_privilege('authenticated','public.academy_lesson_progress','user_id','INSERT')
    or has_column_privilege('authenticated','public.academy_lesson_progress','completed_at','INSERT') then
    raise exception 'Learners must not supply another user or forge completion time';
  end if;
  if not has_column_privilege('authenticated','public.academy_lesson_progress','lesson_id','INSERT') then
    raise exception 'Authorized learners must be able to save their own lesson ID';
  end if;
  if has_table_privilege('authenticated','public.academy_lesson_progress','UPDATE') then
    raise exception 'Learners may not rewrite completion ownership or timestamps';
  end if;
  if has_function_privilege('anon','public.get_academy_team_progress()','EXECUTE')
    or has_function_privilege('anon','public.can_participate_in_academy()','EXECUTE') then
    raise exception 'Anonymous access to Academy helpers must be blocked';
  end if;
  if not has_function_privilege('authenticated','public.get_academy_team_progress()','EXECUTE') then
    raise exception 'Authorized managers cannot reach the scoped roster function';
  end if;
  if not exists(select 1 from pg_policies
    where schemaname='public' and tablename='academy_lesson_progress'
    and cmd='SELECT' and qual like '%auth.uid%') then
    raise exception 'Owner-scoped progress SELECT policy not found';
  end if;
end $$;

do $$
declare found integer;
begin
  select count(*) into found from public.get_academy_team_progress();
  if found <> 0 then
    raise exception 'Manager report must not disclose colleagues without an authenticated requester';
  end if;
end $$;

select 'academy_private_learning_progress_security_passed' as result;
