-- Run only against a disposable local database after replaying migrations.
-- Assert that editorial data is private and approval transitions are gated.

do $$
declare
  table_name text;
  rls_state boolean;
begin
  foreach table_name in array array['editorial_items','editorial_issue_items','editorial_reviews','editorial_events'] loop
    select c.relrowsecurity into rls_state
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname='public' and c.relname=table_name;
    if rls_state is distinct from true then
      raise exception 'RLS is not enabled on %', table_name;
    end if;
    if has_table_privilege('anon','public.' || table_name,'SELECT') then
      raise exception 'Anonymous clients can read editorial data: %', table_name;
    end if;
    if has_table_privilege('authenticated','public.' || table_name,'DELETE') and table_name <> 'editorial_issue_items' then
      raise exception 'Editorial record deletion is enabled: %', table_name;
    end if;
  end loop;

  if not has_table_privilege('authenticated','public.editorial_items','SELECT') then
    raise exception 'Editorial staff lack SELECT grant';
  end if;
  if has_column_privilege('authenticated','public.editorial_items','status','UPDATE') then
    raise exception 'Editorial status must be RPC-only';
  end if;
  if has_column_privilege('authenticated','public.editorial_items','approved_by','UPDATE') then
    raise exception 'Direct editorial approval author changes are forbidden';
  end if;
  if has_table_privilege('authenticated','public.editorial_reviews','INSERT') then
    raise exception 'Review audit events must be RPC-only';
  end if;
  if has_table_privilege('authenticated','public.editorial_events','INSERT') then
    raise exception 'Editorial audit events must be RPC-only';
  end if;
  if has_function_privilege('anon','public.review_editorial_item(uuid,text,text)','EXECUTE') then
    raise exception 'Anonymous clients may invoke editorial review';
  end if;
  if has_function_privilege('anon','public.record_editorial_publication(uuid,text)','EXECUTE') then
    raise exception 'Anonymous clients may invoke publication recording';
  end if;
  if not has_function_privilege('authenticated','public.can_write_editorial()','EXECUTE') then
    raise exception 'Authenticated staff cannot check editorial permissions';
  end if;
end $$;

-- No HTTP request context implies no signed-in actor; all transition RPCs fail.
do $$
begin
  perform public.submit_editorial_item(gen_random_uuid());
  raise exception 'Submitting without an authenticated actor unexpectedly succeeded';
exception when others then
  if sqlerrm not like '%Editorial staff access required%' then
    raise;
  end if;
end $$;

do $$
begin
  perform public.review_editorial_item(gen_random_uuid(),'approved','');
  raise exception 'Approving without an authenticated actor unexpectedly succeeded';
exception when others then
  if sqlerrm not like '%Editorial reviewer permission required%' then
    raise;
  end if;
end $$;

do $$
begin
  perform public.record_editorial_publication(gen_random_uuid(),'https://example.org/test');
  raise exception 'Publication without an authenticated actor unexpectedly succeeded';
exception when others then
  if sqlerrm not like '%Editorial publisher permission required%' then
    raise;
  end if;
end $$;

select 'editorial_workflow_smoke_passed' as result;
