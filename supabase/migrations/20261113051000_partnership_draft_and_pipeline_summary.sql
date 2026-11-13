-- Prevent loss of longer partnership proposals before the formal submission step.
create or replace function public.partnership_portal_save_draft(
 p_case_id uuid,p_proposal text,p_resources text,p_cost_notes text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); c public.partnership_portal_cases%rowtype;
begin
 if uid is null or not public.can_access_partnership_portal() then raise exception 'Not authorized'; end if;
 select * into c from public.partnership_portal_cases where id=p_case_id for update;
 if not found or (c.owner_user_id<>uid and not public.is_super_admin()) then raise exception 'Case not assigned'; end if;
 if c.review_status not in ('not_submitted','changes_requested') then raise exception 'Proposal under review cannot be edited'; end if;
 if length(coalesce(p_proposal,''))>20000 or length(coalesce(p_resources,''))>20000
 or length(coalesce(p_cost_notes,''))>10000 then raise exception 'Draft is too long'; end if;
 update public.partnership_portal_cases set
 proposal_narrative=coalesce(p_proposal,''),requested_resources=coalesce(p_resources,''),
 estimated_cost_notes=coalesce(p_cost_notes,''),updated_at=now()
 where id=p_case_id;
end $$;
revoke all on function public.partnership_portal_save_draft(uuid,text,text,text) from public,anon;
grant execute on function public.partnership_portal_save_draft(uuid,text,text,text) to authenticated;

create or replace function public.partnership_portal_development_queue()
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare output jsonb;
begin
 if auth.uid() is null or not public.current_workspace_identity_active()
    or not public.can_access_workspace_area('development') or not public.is_internal_user()
 then raise exception 'Development authorization required'; end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc),'[]'::jsonb) into output
 from (select r.id,r.case_id,r.status,r.created_at,r.work_item_id,
 c.organization_name,c.program_alignment,c.geography,c.proposal_narrative,c.requested_resources,
 c.estimated_cost_notes,c.owner_user_id,c.partner_id,c.pipeline_id
 from public.partnership_portal_review_requests r
 join public.partnership_portal_cases c on c.id=r.case_id
 order by r.created_at desc limit 100) q;
 return output;
end $$;
revoke all on function public.partnership_portal_development_queue() from public,anon;
grant execute on function public.partnership_portal_development_queue() to authenticated;
