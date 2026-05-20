-- Auto-queue internal notification events when forms are submitted.
-- This creates notification event records only. External delivery is handled separately.

create or replace function public.queue_form_submission_notification_events()
returns trigger as $$
declare
  template_record record;
  route_record record;
  metadata jsonb;
  recipient text;
  should_queue boolean;
begin
  should_queue := new.submission_status = 'submitted'
    and (
      tg_op = 'INSERT'
      or coalesce(old.submission_status, '') <> 'submitted'
      or old.work_item_id is distinct from new.work_item_id
    );

  if not should_queue then
    return new;
  end if;

  select id, name, module
  into template_record
  from public.form_templates
  where id = new.form_template_id;

  if template_record.id is null then
    return new;
  end if;

  select *
  into route_record
  from public.department_notification_routes
  where module = template_record.module::text
    and is_active = true;

  if route_record.id is null then
    return new;
  end if;

  metadata := jsonb_build_object(
    'form_name', template_record.name,
    'module', template_record.module::text,
    'department_name', route_record.department_name,
    'ngo_id', new.ngo_id,
    'submission_status', new.submission_status
  );

  if route_record.slack_channel is not null and length(trim(route_record.slack_channel)) > 0 then
    insert into public.form_notification_events (
      form_submission_id,
      form_template_id,
      work_item_id,
      module,
      notification_type,
      notification_status,
      recipient,
      metadata_json
    ) values (
      new.id,
      new.form_template_id,
      new.work_item_id,
      template_record.module::text,
      'slack',
      'queued',
      route_record.slack_channel,
      metadata
    );
  end if;

  if route_record.email_recipients is not null then
    foreach recipient in array route_record.email_recipients loop
      if recipient is not null and length(trim(recipient)) > 0 then
        insert into public.form_notification_events (
          form_submission_id,
          form_template_id,
          work_item_id,
          module,
          notification_type,
          notification_status,
          recipient,
          metadata_json
        ) values (
          new.id,
          new.form_template_id,
          new.work_item_id,
          template_record.module::text,
          'email',
          'queued',
          recipient,
          metadata
        );
      end if;
    end loop;
  end if;

  if not exists (
    select 1
    from public.form_notification_events
    where form_submission_id = new.id
  ) then
    insert into public.form_notification_events (
      form_submission_id,
      form_template_id,
      work_item_id,
      module,
      notification_type,
      notification_status,
      recipient,
      metadata_json
    ) values (
      new.id,
      new.form_template_id,
      new.work_item_id,
      template_record.module::text,
      'email',
      'skipped',
      null,
      metadata || jsonb_build_object('reason', 'No department notification recipients configured.')
    );
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_queue_form_submission_notification_events on public.form_submissions;
create trigger trg_queue_form_submission_notification_events
after insert or update on public.form_submissions
for each row
execute function public.queue_form_submission_notification_events();
