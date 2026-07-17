-- Forms 100 production contract hardening
--
-- The workspace historically accepted enum-style work-item labels such as
-- `not_started` and `medium`, while the canonical table now stores human
-- labels such as `Not Started` and `Med`. Normalize at the table boundary so
-- form submission, document intake, Trello, and older integrations all honor
-- the same check constraints.

create or replace function public.normalize_work_item_labels()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  status_key text;
  priority_key text;
begin
  if new.status is not null then
    status_key := lower(regexp_replace(trim(new.status), '[ _-]+', ' ', 'g'));
    new.status := case status_key
      when 'draft' then 'Draft'
      when 'not started' then 'Not Started'
      when 'notstarted' then 'Not Started'
      when 'in progress' then 'In Progress'
      when 'waiting on ngo' then 'Waiting on NGO'
      when 'awaiting ngo' then 'Waiting on NGO'
      when 'waiting on hpg' then 'Waiting on HPG'
      when 'submitted' then 'Submitted'
      when 'under review' then 'Under Review'
      when 'approved' then 'Approved'
      when 'rejected' then 'Rejected'
      when 'complete' then 'Complete'
      when 'completed' then 'Complete'
      when 'done' then 'Complete'
      when 'canceled' then 'Canceled'
      when 'cancelled' then 'Canceled'
      else new.status
    end;
  end if;

  if new.priority is not null then
    priority_key := lower(trim(new.priority));
    new.priority := case priority_key
      when 'low' then 'Low'
      when 'med' then 'Med'
      when 'medium' then 'Med'
      when 'high' then 'High'
      when 'critical' then 'High'
      else new.priority
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_normalize_work_item_labels on public.work_items;
create trigger trg_normalize_work_item_labels
before insert or update on public.work_items
for each row execute function public.normalize_work_item_labels();

revoke all on function public.normalize_work_item_labels() from public, anon, authenticated;

-- Cover every relationship used by the forms lifecycle. The composite queue
-- indexes already cover NGO, assignee, and department foreign keys.
create index if not exists form_assignments_template_idx
  on public.form_assignments(form_template_id);
create index if not exists form_assignments_assigned_by_idx
  on public.form_assignments(assigned_by_user_id);
create index if not exists form_assignments_submission_idx
  on public.form_assignments(submission_id);
create index if not exists form_submissions_template_idx
  on public.form_submissions(form_template_id);
create index if not exists form_submissions_ngo_idx
  on public.form_submissions(ngo_id);
create index if not exists form_submissions_reviewer_idx
  on public.form_submissions(reviewed_by_user_id);
create index if not exists form_submissions_work_item_idx
  on public.form_submissions(work_item_id);
create index if not exists form_template_versions_publisher_idx
  on public.form_template_versions(published_by_user_id);

-- One SELECT policy per table keeps portal visibility explicit and avoids
-- policy fan-out. Template versions remain immutable through the Data API.
drop policy if exists "Administrators manage form template versions" on public.form_template_versions;

drop policy if exists "Management can manage templates" on public.form_templates;
drop policy if exists "Active NGO portal templates are readable" on public.form_templates;
drop policy if exists "Internal users can view templates" on public.form_templates;
drop policy if exists "Portal users can view NGO portal form templates" on public.form_templates;
drop policy if exists "read_form_templates" on public.form_templates;

create policy "Authorized users read form templates"
on public.form_templates for select to authenticated
using (
  public.is_internal_user()
  or (is_active and form_audience = 'ngo_portal')
  or exists (
    select 1
    from public.form_assignments fa
    where fa.form_template_id = form_templates.id
      and fa.external_visible
      and (
        fa.assigned_to_user_id = (select auth.uid())
        or (fa.ngo_id is not null and public.has_ngo_access(fa.ngo_id))
      )
  )
);

create policy "Management creates form templates"
on public.form_templates for insert to authenticated
with check (public.is_management());
create policy "Management updates form templates"
on public.form_templates for update to authenticated
using (public.is_management())
with check (public.is_management());
create policy "Management deletes form templates"
on public.form_templates for delete to authenticated
using (public.is_management());

drop policy if exists "Authorized users read form assignments" on public.form_assignments;
drop policy if exists "Internal users create form assignments" on public.form_assignments;
drop policy if exists "Authorized staff update form assignments" on public.form_assignments;
drop policy if exists "Administrators delete form assignments" on public.form_assignments;

create policy "Authorized users read form assignments"
on public.form_assignments for select to authenticated
using (
  public.is_admin_user()
  or assigned_to_user_id = (select auth.uid())
  or (ngo_id is not null and public.has_ngo_access(ngo_id))
  or (department_id is not null and public.is_department_member(department_id))
);
create policy "Internal users create form assignments"
on public.form_assignments for insert to authenticated
with check (public.is_internal_user() and assigned_by_user_id = (select auth.uid()));
create policy "Authorized staff update form assignments"
on public.form_assignments for update to authenticated
using (
  public.is_admin_user()
  or (public.is_internal_user() and department_id is not null and public.is_department_member(department_id))
  or assigned_by_user_id = (select auth.uid())
)
with check (public.is_internal_user());
create policy "Administrators delete form assignments"
on public.form_assignments for delete to authenticated
using (public.is_admin_user());

drop policy if exists "Private drafts and routed submitted forms" on public.form_submissions;
drop policy if exists "Users insert only their private drafts" on public.form_submissions;
drop policy if exists "Users update only their private drafts" on public.form_submissions;
drop policy if exists "Users delete own drafts and admins delete submissions" on public.form_submissions;

create policy "Private drafts and routed submitted forms"
on public.form_submissions for select to authenticated
using (
  submitted_by_user_id = (select auth.uid())
  or (
    submission_status <> 'draft'
    and (
      public.is_admin_user()
      or exists (
        select 1 from public.work_items wi
        where wi.id = form_submissions.work_item_id
          and public.is_department_member(wi.department_id)
      )
      or (ngo_id is not null and public.has_ngo_access(ngo_id))
    )
  )
);
create policy "Users insert only their private drafts"
on public.form_submissions for insert to authenticated
with check (
  submitted_by_user_id = (select auth.uid())
  and submission_status = 'draft'
  and work_item_id is null
);
create policy "Users update only their private drafts"
on public.form_submissions for update to authenticated
using (submitted_by_user_id = (select auth.uid()) and submission_status = 'draft')
with check (
  submitted_by_user_id = (select auth.uid())
  and submission_status = 'draft'
  and work_item_id is null
  and submitted_at is null
);
create policy "Users delete own drafts and admins delete submissions"
on public.form_submissions for delete to authenticated
using (
  (submitted_by_user_id = (select auth.uid()) and submission_status = 'draft')
  or public.is_admin_user()
);

-- Review decisions use the canonical labels expected by the current
-- work_items table. Rejection hands the item back to the NGO; acceptance
-- completes it and sets the completion timestamp.
create or replace function public.review_form_submission(
  p_submission_id uuid,
  p_decision text,
  p_notes text default null
)
returns public.form_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  row_out public.form_submissions;
  work_row public.work_items;
  decision_text text := lower(trim(coalesce(p_decision,'')));
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if decision_text not in ('accepted','rejected') then raise exception 'Decision must be accepted or rejected'; end if;

  select wi.* into work_row
  from public.form_submissions fs
  join public.work_items wi on wi.id = fs.work_item_id
  where fs.id = p_submission_id and fs.submission_status = 'submitted';
  if work_row.id is null then raise exception 'Submitted form not found'; end if;
  if not (public.is_admin_user() or public.is_department_member(work_row.department_id)) then
    raise exception 'Responsible department access required';
  end if;

  update public.form_submissions
  set submission_status = decision_text,
      reviewed_by_user_id = auth.uid(),
      reviewed_at = now(),
      review_notes = nullif(trim(p_notes),''),
      updated_at = now()
  where id = p_submission_id
  returning * into row_out;

  update public.work_items
  set status = case when decision_text = 'accepted' then 'Complete' else 'Waiting on NGO' end,
      completed_at = case when decision_text = 'accepted' then now() else null end,
      updated_at = now()
  where id = work_row.id;

  if row_out.assignment_id is not null then
    update public.form_assignments
    set status = case when decision_text = 'accepted' then 'accepted' else 'needs_revision' end,
        updated_at = now()
    where id = row_out.assignment_id;
  end if;

  insert into public.audit_log(actor_user_id, action_type, entity_type, entity_id, reason, after_json)
  values (
    auth.uid(), 'review', 'form_submission', row_out.id,
    nullif(trim(p_notes),''),
    jsonb_build_object('decision',decision_text,'work_item_id',work_row.id,'assignment_id',row_out.assignment_id)
  );
  return row_out;
end;
$$;

revoke all on function public.review_form_submission(uuid,text,text) from public, anon;
grant execute on function public.review_form_submission(uuid,text,text) to authenticated;

comment on function public.normalize_work_item_labels() is
  'Canonicalizes legacy work-item status and priority inputs before constraints are evaluated.';
