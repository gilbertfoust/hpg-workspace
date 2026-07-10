-- Require human review before any clarification is sent for an unmatched or
-- low-confidence case. This is a conservative safety gate and does not enable
-- any external communication worker.

create or replace function public.agent_os_guard_unmatched_clarification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match_confidence text;
  v_unmatched_reason text;
begin
  if new.case_registry_id is null then
    return new;
  end if;

  if new.communication_type not in (
    'neutral_case_clarification',
    'unmatched_case_clarification',
    'case_match_clarification'
  ) then
    return new;
  end if;

  select c.match_confidence, c.unmatched_reason
    into v_match_confidence, v_unmatched_reason
    from public.case_registry c
   where c.id = new.case_registry_id;

  if lower(coalesce(v_match_confidence, '')) in ('low', 'none', 'unmatched')
     or nullif(btrim(coalesce(v_unmatched_reason, '')), '') is not null then
    new.authority_level := 'draft_for_review';
    new.requires_human_review := true;

    if new.status in ('pending', 'approved', 'processing') then
      new.status := 'pending_review';
    end if;

    new.source_context := coalesce(new.source_context, '{}'::jsonb)
      || jsonb_build_object(
        'unmatched_review_gate', true,
        'unmatched_review_gate_applied_at', now()
      );
  end if;

  return new;
end;
$$;

revoke all on function public.agent_os_guard_unmatched_clarification() from public;

update public.communication_queue q
   set authority_level = 'draft_for_review',
       requires_human_review = true,
       status = case
         when q.status in ('pending', 'approved', 'processing') then 'pending_review'
         else q.status
       end,
       source_context = coalesce(q.source_context, '{}'::jsonb)
         || jsonb_build_object(
           'unmatched_review_gate', true,
           'unmatched_review_gate_applied_at', now()
         )
  from public.case_registry c
 where q.case_registry_id = c.id
   and q.communication_type in (
     'neutral_case_clarification',
     'unmatched_case_clarification',
     'case_match_clarification'
   )
   and (
     lower(coalesce(c.match_confidence, '')) in ('low', 'none', 'unmatched')
     or nullif(btrim(coalesce(c.unmatched_reason, '')), '') is not null
   )
   and (
     q.authority_level <> 'draft_for_review'
     or not q.requires_human_review
     or q.status in ('pending', 'approved', 'processing')
   );

drop trigger if exists communication_queue_unmatched_review_gate
  on public.communication_queue;

create trigger communication_queue_unmatched_review_gate
before insert or update of
  case_registry_id,
  communication_type,
  authority_level,
  requires_human_review,
  status
on public.communication_queue
for each row
execute function public.agent_os_guard_unmatched_clarification();

comment on function public.agent_os_guard_unmatched_clarification() is
  'Forces clarification messages linked to unmatched or low-confidence cases into human review before delivery.';
