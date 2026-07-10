-- Synchronize international activation-form invitation and sponsorship case
-- state with the controlled communication worker.

create or replace function public.agent_os_sync_external_form_delivery()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation_id uuid;
  v_case_id uuid;
begin
  if new.communication_type <> 'international_activation_fee_form'
     or new.status is not distinct from old.status then
    return new;
  end if;

  begin
    v_invitation_id := nullif(new.source_context->>'invitation_id', '')::uuid;
  exception when invalid_text_representation then
    v_invitation_id := null;
  end;

  if v_invitation_id is null then
    return new;
  end if;

  select case_registry_id into v_case_id
  from public.agent_os_external_form_invitations
  where id = v_invitation_id;

  if v_case_id is null then
    return new;
  end if;

  if new.status = 'sent' then
    update public.agent_os_external_form_invitations
    set status = case when status = 'pending' then 'sent' else status end,
        sent_at = coalesce(sent_at, new.sent_at, now()),
        last_error = null,
        updated_at = now()
    where id = v_invitation_id;

    update public.case_registry
    set workflow_stage = case
          when workflow_stage = 'agreement_signed' then 'onboarding_fee_form_sent'
          else workflow_stage
        end,
        activation_fee_form_sent_at = coalesce(activation_fee_form_sent_at, new.sent_at, now()),
        next_action = 'Await the international NGO activation form and $100 USD payment.',
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'international_activation_form_communication_id', new.id,
          'international_activation_form_sent_at', coalesce(new.sent_at, now())
        ),
        updated_at = now()
    where id = v_case_id;
  elsif new.status in ('failed','blocked','cancelled') then
    update public.agent_os_external_form_invitations
    set status = 'failed',
        last_error = coalesce(new.error_message, 'External form invitation delivery failed.'),
        updated_at = now()
    where id = v_invitation_id
      and status not in ('submitted','revoked','expired');

    update public.case_registry
    set next_action = 'Human review required: the international activation fee form email was not delivered.',
        priority = case when priority = 'critical' then priority else 'urgent' end,
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'international_activation_form_delivery_status', new.status,
          'international_activation_form_delivery_error', new.error_message,
          'international_activation_form_communication_id', new.id
        ),
        updated_at = now()
    where id = v_case_id;
  end if;

  return new;
end;
$$;

drop trigger if exists communication_queue_sync_external_form_delivery on public.communication_queue;
create trigger communication_queue_sync_external_form_delivery
after update of status on public.communication_queue
for each row execute function public.agent_os_sync_external_form_delivery();

comment on function public.agent_os_sync_external_form_delivery()
  is 'Marks the international activation invitation sent only after the controlled email worker succeeds, and escalates terminal delivery failures.';
