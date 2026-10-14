-- Maintain exact executive queue counts without scanning evidence per decision.
create table if not exists public.executive_decision_item_totals (
decision_item_id uuid primary key references public.executive_decision_items(id) on delete cascade,
evidence_count integer not null default 0 check (evidence_count>=0),
option_count integer not null default 0 check (option_count>=0),
updated_at timestamptz not null default now()
);
alter table public.executive_decision_item_totals enable row level security;
revoke all on public.executive_decision_item_totals from public,anon,authenticated;
grant select on public.executive_decision_item_totals to authenticated;
grant all on public.executive_decision_item_totals to service_role;
drop policy if exists "executive_decision_totals_executive_read" on public.executive_decision_item_totals;
create policy "executive_decision_totals_executive_read" on public.executive_decision_item_totals for select to authenticated using ((( SELECT current_workspace_identity_active() AS current_workspace_identity_active) AND ( SELECT agent_os_phase6_is_executive_reader() AS agent_os_phase6_is_executive_reader)));
lock table public.executive_decision_evidence,public.executive_decision_options in share row exclusive mode;
insert into public.executive_decision_item_totals(decision_item_id,evidence_count,option_count)
select d.id,coalesce(e.n,0)::integer,coalesce(o.n,0)::integer from public.executive_decision_items d
left join (select decision_item_id,count(*) n from public.executive_decision_evidence group by decision_item_id)e on e.decision_item_id=d.id
left join (select decision_item_id,count(*) n from public.executive_decision_options group by decision_item_id)o on o.decision_item_id=d.id
on conflict(decision_item_id) do update set evidence_count=excluded.evidence_count,option_count=excluded.option_count,updated_at=now();
CREATE OR REPLACE FUNCTION public.workspace_executive_exceptions(p_limit integer DEFAULT 100)
 RETURNS TABLE(id uuid, reference text, title text, question text, access_area text, category text, severity text, status text, authority_user_id uuid, authority_name text, accountable_role text, due_at timestamp with time zone, overdue boolean, evidence_count integer, option_count integer, recommendation text, refreshed_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
 SET jit TO 'off'
AS $function$
begin
 if public.current_workspace_identity_active() is not true or public.agent_os_phase6_is_executive_reader() is not true then
  raise exception 'Executive reader access required' using errcode='42501';
 end if;
 return query
 with queue as materialized (
  select item.id,item.decision_reference,item.title,item.decision_question,item.source_access_area,item.category,item.severity_key,item.status,item.decision_authority_user_id,item.accountable_human_role,item.decision_required_by,item.recommendation_summary,item.last_refreshed_at,item.priority_score
  from public.executive_decision_items item
  where not item.is_synthetic and item.status in ('queued','under_review','deferred','returned_for_evidence')
  order by case item.severity_key when 'critical' then 0 when 'high_risk' then 1 else 2 end,item.decision_required_by asc nulls last,item.priority_score desc,item.id
  limit greatest(1,least(coalesce(p_limit,100),200))
 )
 select q.id,q.decision_reference,q.title,q.decision_question,q.source_access_area,q.category,q.severity_key,q.status,q.decision_authority_user_id,p.full_name,q.accountable_human_role,q.decision_required_by,coalesce(q.decision_required_by<now(),false),coalesce(t.evidence_count,0),coalesce(t.option_count,0),q.recommendation_summary,q.last_refreshed_at
 from queue q left join public.profiles p on p.id=q.decision_authority_user_id left join public.executive_decision_item_totals t on t.decision_item_id=q.id
 order by case q.severity_key when 'critical' then 0 when 'high_risk' then 1 else 2 end,q.decision_required_by asc nulls last,q.priority_score desc,q.id;
end;
$function$

CREATE OR REPLACE FUNCTION private.sync_executive_decision_item_totals()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
begin
 if tg_op='UPDATE' and old.decision_item_id is not distinct from new.decision_item_id then return new; end if;
 if tg_op in ('UPDATE','DELETE') then
  if tg_table_name='executive_decision_evidence' then
   update public.executive_decision_item_totals set evidence_count=greatest(0,evidence_count-1),updated_at=now() where decision_item_id=old.decision_item_id;
  else
   update public.executive_decision_item_totals set option_count=greatest(0,option_count-1),updated_at=now() where decision_item_id=old.decision_item_id;
  end if;
 end if;
 if tg_op in ('INSERT','UPDATE') then
  if tg_table_name='executive_decision_evidence' then
   insert into public.executive_decision_item_totals(decision_item_id,evidence_count,option_count)
   values(new.decision_item_id,1,0) on conflict(decision_item_id) do update set evidence_count=public.executive_decision_item_totals.evidence_count+1,updated_at=now();
  else
   insert into public.executive_decision_item_totals(decision_item_id,evidence_count,option_count)
   values(new.decision_item_id,0,1) on conflict(decision_item_id) do update set option_count=public.executive_decision_item_totals.option_count+1,updated_at=now();
  end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $function$

revoke all on function private.sync_executive_decision_item_totals() from public,anon,authenticated;
CREATE OR REPLACE TRIGGER maintain_executive_evidence_totals AFTER INSERT OR DELETE OR UPDATE OF decision_item_id ON public.executive_decision_evidence FOR EACH ROW EXECUTE FUNCTION private.sync_executive_decision_item_totals();
CREATE OR REPLACE TRIGGER maintain_executive_option_totals AFTER INSERT OR DELETE OR UPDATE OF decision_item_id ON public.executive_decision_options FOR EACH ROW EXECUTE FUNCTION private.sync_executive_decision_item_totals();
