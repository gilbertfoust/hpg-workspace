-- Prevent a replaced external-form invitation from being emailed after its
-- token has been revoked. This preserves one usable invitation per case/form.

create or replace function public.agent_os_cancel_revoked_invitation_communications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'revoked' and new.status is distinct from old.status then
    update public.communication_queue
    set status = 'cancelled',
        error_message = 'Invitation replaced before delivery; queued communication cancelled.',
        updated_at = now()
    where communication_type = 'international_activation_fee_form'
      and source_context->>'invitation_id' = new.id::text
      and status in ('pending', 'approved', 'pending_review');
  end if;

  return new;
end;
$$;

drop trigger if exists agent_os_cancel_revoked_invitation_communications
  on public.agent_os_external_form_invitations;
create trigger agent_os_cancel_revoked_invitation_communications
after update of status on public.agent_os_external_form_invitations
for each row execute function public.agent_os_cancel_revoked_invitation_communications();

comment on function public.agent_os_cancel_revoked_invitation_communications()
  is 'Cancels unsent communication records when an external form invitation is revoked or replaced.';
