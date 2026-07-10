-- Remove Supabase's default anon EXECUTE grants from newly added Agent OS
-- functions and apply least-privilege execution rules.

revoke all on function public.agent_os_authorize_worker_recovery(uuid,text,text,timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.agent_os_authorize_worker_recovery(uuid,text,text,timestamptz)
  to authenticated, service_role;

revoke all on function public.agent_os_business_days_overdue(timestamptz,timestamptz)
  from public, anon, authenticated, service_role;

revoke all on function public.agent_os_guard_report_packet()
  from public, anon, authenticated, service_role;

revoke all on function public.agent_os_guard_unmatched_clarification()
  from public, anon, authenticated, service_role;

revoke all on function public.agent_os_link_report_packet(uuid,uuid,text)
  from public, anon, authenticated, service_role;
grant execute on function public.agent_os_link_report_packet(uuid,uuid,text)
  to authenticated, service_role;

revoke all on function public.agent_os_prepare_document_intake(uuid,text,text,text,text,text,bigint,text,text,text,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.agent_os_prepare_document_intake(uuid,text,text,text,text,text,bigint,text,text,text,jsonb)
  to authenticated, service_role;

revoke all on function public.agent_os_process_overdue_escalations(timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.agent_os_process_overdue_escalations(timestamptz)
  to service_role;

revoke all on function public.agent_os_record_worker_failure(text,uuid,text,jsonb,boolean,timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.agent_os_record_worker_failure(text,uuid,text,jsonb,boolean,timestamptz)
  to service_role;

revoke all on function public.agent_os_safe_file_token(text)
  from public, anon, authenticated, service_role;

comment on function public.agent_os_process_overdue_escalations(timestamptz) is
  'Service-role-only scheduler that creates internal escalation events; it performs no external delivery.';
comment on function public.agent_os_record_worker_failure(text,uuid,text,jsonb,boolean,timestamptz) is
  'Service-role-only worker callback that records retries and terminal failure recovery state.';
