-- Non-destructive internal research library privacy and review checks.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'workspace_research_sources','workspace_research_annotations','workspace_research_reviews'
  ] loop
    if not coalesce((select relrowsecurity from pg_class
      where oid=('public.'||table_name)::regclass),false) then
      raise exception 'Research table % must have RLS enabled',table_name;
    end if;
    if has_table_privilege('anon','public.'||table_name,'SELECT')
      or has_table_privilege('anon','public.'||table_name,'INSERT')
      or has_table_privilege('authenticated','public.'||table_name,'INSERT')
      or has_table_privilege('authenticated','public.'||table_name,'UPDATE')
      or has_table_privilege('authenticated','public.'||table_name,'DELETE') then
      raise exception 'Research table % allows direct unauthorized access',table_name;
    end if;
  end loop;
  if has_function_privilege('anon',
    'public.create_workspace_research_source(text,text,text,text,text,text,text,text,text,text,text,date)','EXECUTE')
    or has_function_privilege('anon','public.submit_workspace_research_source(uuid)','EXECUTE')
    or has_function_privilege('anon','public.review_workspace_research_source(uuid,text,text)','EXECUTE')
    or has_function_privilege('anon','public.add_workspace_research_annotation(uuid,text,text,text)','EXECUTE') then
    raise exception 'Anonymous research workflow RPC access forbidden';
  end if;
end $$;
do $$
begin
  perform public.create_workspace_research_source(
    'Imaginary source','Example','Example','https://example.org','primary',
    'This is a purely fictional citation for an access control test','', '', '',
    'internal','en',null
  );
  raise exception 'Unauthenticated visitor unexpectedly created a research source';
exception when others then
  if sqlerrm not like '%Approved HPG research staff required%' then raise; end if;
end $$;
do $$
begin
  perform public.review_workspace_research_source(gen_random_uuid(),'verified',
    'This must never be recorded by an unauthenticated visitor.');
  raise exception 'Unauthenticated visitor unexpectedly verified a research citation';
exception when others then
  if sqlerrm not like '%Independent authorized HPG research reviewer required%' then raise; end if;
end $$;
select 'workspace_research_library_privacy_passed' as result;
