-- HPG Global Fiscal Sponsor OS MVP foundation
--
-- This migration repairs the highest-risk workflow seams identified during the
-- July 2026 workspace audit:
--   * private form drafts that never create work items
--   * atomic form submission + department-routed work item creation
--   * department-scoped work item access and multi-assignee queues
--   * reliable module -> org_units routing (the work_items FK points to
--     org_units, not the legacy departments catalog)
--   * Trello member mappings and inbound webhook idempotency
--   * profile fields needed by staff dashboards and international users
--   * Finance role alignment and an audited chart-of-accounts creation RPC

-- ---------------------------------------------------------------------------
-- Staff profiles and department membership
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists job_title text,
  add column if not exists timezone text not null default 'UTC',
  add column if not exists preferred_language text not null default 'en',
  add column if not exists country_code text,
  add column if not exists phone text,
  add column if not exists bio text,
  add column if not exists employment_status text not null default 'active',
  add column if not exists manager_user_id uuid references public.profiles(id) on delete set null;

alter table public.profiles drop constraint if exists profiles_preferred_language_check;
alter table public.profiles add constraint profiles_preferred_language_check
  check (preferred_language in ('en','es','fr','pt','ar','sw','bn'));

alter table public.profiles drop constraint if exists profiles_employment_status_check;
alter table public.profiles add constraint profiles_employment_status_check
  check (employment_status in ('invited','active','leave','suspended','inactive'));

create table if not exists public.department_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  department_id uuid not null references public.org_units(id) on delete cascade,
  membership_role text not null default 'member'
    check (membership_role in ('member','lead','approver','viewer')),
  is_primary boolean not null default false,
  is_active boolean not null default true,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, department_id)
);

create unique index if not exists department_memberships_one_primary_idx
  on public.department_memberships(user_id)
  where is_primary and is_active;
create index if not exists department_memberships_department_idx
  on public.department_memberships(department_id, user_id)
  where is_active;

alter table public.department_memberships enable row level security;
drop policy if exists "Users read own department memberships" on public.department_memberships;
create policy "Users read own department memberships"
  on public.department_memberships for select to authenticated
  using (user_id = auth.uid() or public.is_admin_user());
drop policy if exists "Admins manage department memberships" on public.department_memberships;
create policy "Admins manage department memberships"
  on public.department_memberships for all to authenticated
  using (public.is_admin_user()) with check (public.is_admin_user());

insert into public.department_memberships (
  user_id, department_id, membership_role, is_primary, is_active
)
select
  p.id,
  p.department_id,
  case when p.role = 'department_lead' then 'lead' else 'member' end,
  true,
  true
from public.profiles p
where p.department_id is not null
on conflict (user_id, department_id) do update set
  is_primary = true,
  is_active = true,
  membership_role = excluded.membership_role,
  updated_at = now();

-- Preserve staff access while the navigation and routing model consolidates
-- legacy departments beneath their new owning hubs.
insert into public.department_memberships(
  user_id, department_id, membership_role, is_primary, is_active
)
select
  p.id,
  target_unit.id,
  case when p.role = 'department_lead' then 'lead' else 'member' end,
  false,
  true
from public.profiles p
join public.org_units current_unit on current_unit.id = p.department_id
join public.org_units target_unit on target_unit.sub_department_name is null
where (
  lower(trim(current_unit.department_name)) = 'ngo coordination'
  and lower(trim(target_unit.department_name)) = 'program'
) or (
  lower(trim(current_unit.department_name)) = 'partnership development'
  and lower(trim(target_unit.department_name)) = 'development'
)
on conflict (user_id, department_id) do update set
  is_active = true,
  membership_role = excluded.membership_role,
  updated_at = now();

create or replace function public.is_department_member(p_department_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_department_id is not null and (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.department_id = p_department_id
    )
    or exists (
      select 1 from public.department_memberships dm
      where dm.user_id = auth.uid()
        and dm.department_id = p_department_id
        and dm.is_active
    )
  );
$$;

revoke all on function public.is_department_member(uuid) from public, anon;
grant execute on function public.is_department_member(uuid) to authenticated;

-- The canonical work_items.department_id FK targets org_units. Resolve module
-- ownership there and retire the incompatible legacy departments-table lookup.
create or replace function public.resolve_work_item_department(p_module public.module_type)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  with wanted as (
    select case p_module::text
      when 'ngo_coordination' then array['program']
      when 'program' then array['program']
      when 'curriculum' then array['program']
      when 'partnership' then array['development','partnership development']
      when 'development' then array['development']
      when 'finance' then array['finance']
      when 'hr' then array['hr','human resources']
      when 'it' then array['it','information technology','technology']
      when 'legal' then array['compliance','legal','legal / compliance']
      else array[replace(p_module::text, '_', ' ')]
    end as names
  )
  select ou.id
  from public.org_units ou, wanted
  where lower(trim(ou.department_name)) = any(wanted.names)
  order by
    case when ou.sub_department_name is null then 0 else 1 end,
    ou.created_at
  limit 1;
$$;

revoke all on function public.resolve_work_item_department(public.module_type) from public, anon;
grant execute on function public.resolve_work_item_department(public.module_type) to authenticated, service_role;

create or replace function public.assign_work_item_department_from_module()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.department_id is null or (
    tg_op = 'UPDATE' and new.module is distinct from old.module
      and new.department_id is not distinct from old.department_id
  ) then
    new.department_id := public.resolve_work_item_department(new.module);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assign_work_item_department_from_module on public.work_items;
create trigger trg_assign_work_item_department_from_module
before insert or update of module, department_id on public.work_items
for each row execute function public.assign_work_item_department_from_module();

-- ---------------------------------------------------------------------------
-- Department-scoped work items and personal queues
-- ---------------------------------------------------------------------------

alter table public.work_items
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists delete_reason text,
  add column if not exists sync_version bigint not null default 1,
  add column if not exists last_external_sync_at timestamptz;

create table if not exists public.work_item_assignees (
  work_item_id uuid not null references public.work_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  assignment_role text not null default 'assignee'
    check (assignment_role in ('owner','assignee','reviewer','watcher')),
  source_system text not null default 'workspace',
  external_member_id text,
  assigned_at timestamptz not null default now(),
  assigned_by_user_id uuid references public.profiles(id) on delete set null,
  primary key (work_item_id, user_id, assignment_role)
);

create index if not exists work_item_assignees_user_idx
  on public.work_item_assignees(user_id, work_item_id);
alter table public.work_item_assignees enable row level security;

-- Keep assignment checks out of policy-to-policy joins. Without these
-- SECURITY DEFINER helpers, work_items -> work_item_assignees -> work_items can
-- recurse indefinitely while PostgreSQL evaluates RLS.
create or replace function public.is_work_item_assignee(
  p_work_item_id uuid,
  p_assignment_roles text[] default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.work_item_assignees a
    where a.work_item_id = p_work_item_id
      and a.user_id = auth.uid()
      and (
        p_assignment_roles is null
        or a.assignment_role = any(p_assignment_roles)
      )
  );
$$;

create or replace function public.can_manage_work_item_assignments(p_work_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin_user()
    or exists (
      select 1
      from public.work_items wi
      where wi.id = p_work_item_id
        and wi.deleted_at is null
        and (
          wi.owner_user_id = auth.uid()
          or public.is_department_member(wi.department_id)
        )
    );
$$;

revoke all on function public.is_work_item_assignee(uuid,text[]) from public, anon;
grant execute on function public.is_work_item_assignee(uuid,text[]) to authenticated;
revoke all on function public.can_manage_work_item_assignments(uuid) from public, anon;
grant execute on function public.can_manage_work_item_assignments(uuid) to authenticated;

drop policy if exists "Accessible users read work item assignees" on public.work_item_assignees;
create policy "Accessible users read work item assignees"
  on public.work_item_assignees for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin_user()
    or public.can_manage_work_item_assignments(work_item_id)
  );
drop policy if exists "Department users manage work item assignees" on public.work_item_assignees;
create policy "Department users manage work item assignees"
  on public.work_item_assignees for all to authenticated
  using (
    public.can_manage_work_item_assignments(work_item_id)
  )
  with check (
    public.can_manage_work_item_assignments(work_item_id)
  );

create or replace function public.default_work_item_creator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by_user_id is null and auth.uid() is not null then
    new.created_by_user_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_default_work_item_creator on public.work_items;
create trigger trg_default_work_item_creator
before insert on public.work_items
for each row execute function public.default_work_item_creator();

-- Remove the accumulated permissive work-item policies and replace them with
-- one auditable access model. Submitted form work is intentionally not visible
-- merely because a user created the source form; it belongs to its department.
do $$
declare policy_row record;
begin
  for policy_row in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'work_items'
  loop
    execute format('drop policy if exists %I on public.work_items', policy_row.policyname);
  end loop;
end
$$;

create policy "Scoped work item read"
on public.work_items for select to authenticated
using (
  deleted_at is null
  and (
    public.is_admin_user()
    or owner_user_id = auth.uid()
    or public.is_department_member(department_id)
    or public.is_work_item_assignee(work_items.id, null)
    or (
      created_by_user_id = auth.uid()
      and coalesce(source_system, 'workspace') <> 'form_submission'
    )
    or (
      external_visible
      and ngo_id is not null
      and public.has_ngo_access(ngo_id)
    )
  )
);

create policy "Internal users create routed work items"
on public.work_items for insert to authenticated
with check (
  public.is_internal_user()
  and (created_by_user_id = auth.uid() or public.is_admin_user())
);

create policy "Scoped work item update"
on public.work_items for update to authenticated
using (
  deleted_at is null
  and (
    public.is_admin_user()
    or owner_user_id = auth.uid()
    or public.is_department_member(department_id)
    or public.is_work_item_assignee(
      work_items.id,
      array['owner','assignee','reviewer']::text[]
    )
  )
)
with check (
  public.is_admin_user()
  or owner_user_id = auth.uid()
  or public.is_department_member(department_id)
  or public.is_work_item_assignee(
    work_items.id,
    array['owner','assignee','reviewer']::text[]
  )
);

create policy "Admins delete work items"
on public.work_items for delete to authenticated
using (public.is_admin_user());

create or replace function public.get_my_queue_work_items()
returns setof public.work_items
language sql
stable
security invoker
set search_path = public
as $$
  select wi.*
  from public.work_items wi
  where wi.deleted_at is null
    and wi.archived_at is null
    and (
      wi.owner_user_id = auth.uid()
      or exists (
        select 1 from public.work_item_assignees a
        where a.work_item_id = wi.id
          and a.user_id = auth.uid()
          and a.assignment_role in ('owner','assignee','reviewer')
      )
    )
  order by wi.created_at desc;
$$;

revoke all on function public.get_my_queue_work_items() from public, anon;
grant execute on function public.get_my_queue_work_items() to authenticated;

create or replace function public.get_my_staff_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  profile_json jsonb;
  staff_id_value uuid;
  open_count integer;
  overdue_count integer;
  due_soon_count integer;
  completed_30_count integer;
  created_30_count integer;
  document_count integer;
  hours_current_period numeric;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select jsonb_build_object(
    'id', p.id,
    'full_name', p.full_name,
    'email', p.email,
    'avatar_url', p.avatar_url,
    'job_title', p.job_title,
    'role', p.role,
    'department_id', p.department_id,
    'department_name', ou.department_name,
    'employment_status', p.employment_status,
    'preferred_language', p.preferred_language,
    'timezone', p.timezone
  ), sp.id
  into profile_json, staff_id_value
  from public.profiles p
  left join public.org_units ou on ou.id = p.department_id
  left join public.staff_profiles sp on sp.user_id = p.id
  where p.id = auth.uid()
  limit 1;

  select
    count(*) filter (where wi.status not in ('complete','canceled')),
    count(*) filter (
      where wi.status not in ('complete','canceled') and wi.due_date < current_date
    ),
    count(*) filter (
      where wi.status not in ('complete','canceled')
        and wi.due_date between current_date and current_date + 7
    ),
    count(*) filter (
      where wi.status = 'complete' and wi.completed_at >= now() - interval '30 days'
    ),
    count(*) filter (where wi.created_at >= now() - interval '30 days')
  into open_count, overdue_count, due_soon_count, completed_30_count, created_30_count
  from public.work_items wi
  where wi.deleted_at is null
    and wi.archived_at is null
    and (
      wi.owner_user_id = auth.uid()
      or exists (
        select 1 from public.work_item_assignees a
        where a.work_item_id = wi.id and a.user_id = auth.uid()
      )
    );

  select count(*) into document_count
  from public.documents d where d.uploaded_by_user_id = auth.uid();

  if staff_id_value is not null then
    select coalesce(sum(t.total_hours),0) into hours_current_period
    from public.timesheets t
    where t.staff_id = staff_id_value
      and t.period_end >= date_trunc('month', current_date)::date
      and t.period_start < (date_trunc('month', current_date) + interval '1 month')::date;
  else
    hours_current_period := 0;
  end if;

  return jsonb_build_object(
    'profile', coalesce(profile_json,'{}'::jsonb),
    'work', jsonb_build_object(
      'open', coalesce(open_count,0),
      'overdue', coalesce(overdue_count,0),
      'due_soon', coalesce(due_soon_count,0),
      'completed_30_days', coalesce(completed_30_count,0),
      'created_30_days', coalesce(created_30_count,0),
      'completion_rate_30_days', case
        when coalesce(created_30_count,0) = 0 then 0
        else round((completed_30_count::numeric / created_30_count::numeric) * 100, 1)
      end
    ),
    'hr', jsonb_build_object(
      'staff_profile_id', staff_id_value,
      'hours_current_month', coalesce(hours_current_period,0)
    ),
    'documents', jsonb_build_object('uploaded', coalesce(document_count,0))
  );
end;
$$;

revoke all on function public.get_my_staff_dashboard() from public, anon;
grant execute on function public.get_my_staff_dashboard() to authenticated;

create or replace function public.admin_soft_delete_work_item(
  p_work_item_id uuid,
  p_reason text default 'Deleted by administrator'
)
returns public.work_items
language plpgsql
security definer
set search_path = public
as $$
declare row_out public.work_items;
begin
  if auth.uid() is null or not public.is_admin_user() then
    raise exception 'Administrator access required';
  end if;
  update public.work_items
  set deleted_at = now(), deleted_by_user_id = auth.uid(),
      delete_reason = coalesce(nullif(trim(p_reason), ''), 'Deleted by administrator'),
      updated_at = now()
  where id = p_work_item_id and deleted_at is null
  returning * into row_out;
  if row_out.id is null then raise exception 'Work item not found'; end if;
  insert into public.audit_log(actor_user_id, action_type, entity_type, entity_id, reason, after_json)
  values (auth.uid(), 'soft_delete', 'work_item', row_out.id, row_out.delete_reason, to_jsonb(row_out));
  return row_out;
end;
$$;

revoke all on function public.admin_soft_delete_work_item(uuid,text) from public, anon;
grant execute on function public.admin_soft_delete_work_item(uuid,text) to authenticated;

-- ---------------------------------------------------------------------------
-- Private drafts and atomic department-routed form submission
-- ---------------------------------------------------------------------------

alter table public.form_submissions
  add column if not exists draft_progress smallint not null default 0,
  add column if not exists submitted_version integer,
  add column if not exists locked_at timestamptz,
  add column if not exists idempotency_key text;

alter table public.form_submissions drop constraint if exists form_submissions_draft_progress_check;
alter table public.form_submissions add constraint form_submissions_draft_progress_check
  check (draft_progress between 0 and 100);
create unique index if not exists form_submissions_idempotency_idx
  on public.form_submissions(submitted_by_user_id, idempotency_key)
  where idempotency_key is not null;

do $$
declare policy_row record;
begin
  for policy_row in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'form_submissions'
  loop
    execute format('drop policy if exists %I on public.form_submissions', policy_row.policyname);
  end loop;
end
$$;

create policy "Private drafts and routed submitted forms"
on public.form_submissions for select to authenticated
using (
  submitted_by_user_id = auth.uid()
  or (
    submission_status <> 'draft'
    and (
      public.is_admin_user()
      or exists (
        select 1
        from public.work_items wi
        where wi.id = form_submissions.work_item_id
          and public.is_department_member(wi.department_id)
      )
      or (
        ngo_id is not null
        and public.has_ngo_access(ngo_id)
      )
    )
  )
);

create policy "Users insert only their private drafts"
on public.form_submissions for insert to authenticated
with check (
  submitted_by_user_id = auth.uid()
  and submission_status = 'draft'
  and work_item_id is null
);

create policy "Users update only their private drafts"
on public.form_submissions for update to authenticated
using (submitted_by_user_id = auth.uid() and submission_status = 'draft')
with check (
  submitted_by_user_id = auth.uid()
  and submission_status = 'draft'
  and work_item_id is null
  and submitted_at is null
);

create policy "Users delete own drafts and admins delete submissions"
on public.form_submissions for delete to authenticated
using (
  (submitted_by_user_id = auth.uid() and submission_status = 'draft')
  or public.is_admin_user()
);

create or replace function public.save_form_draft(
  p_form_template_id uuid,
  p_payload_json jsonb default '{}'::jsonb,
  p_ngo_id uuid default null,
  p_submission_id uuid default null,
  p_progress smallint default 0
)
returns public.form_submissions
language plpgsql
security definer
set search_path = public
as $$
declare row_out public.form_submissions;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.form_templates where id = p_form_template_id and is_active) then
    raise exception 'Active form template not found';
  end if;
  if p_ngo_id is not null and not (public.is_internal_user() or public.has_ngo_access(p_ngo_id)) then
    raise exception 'NGO access denied';
  end if;

  if p_submission_id is null then
    insert into public.form_submissions(
      form_template_id, ngo_id, submitted_by_user_id, payload_json,
      submission_status, submitted_at, work_item_id, draft_progress
    ) values (
      p_form_template_id, p_ngo_id, auth.uid(), coalesce(p_payload_json,'{}'::jsonb),
      'draft', null, null, greatest(0,least(coalesce(p_progress,0),100))
    ) returning * into row_out;
  else
    update public.form_submissions
    set form_template_id = p_form_template_id,
        ngo_id = p_ngo_id,
        payload_json = coalesce(p_payload_json,'{}'::jsonb),
        draft_progress = greatest(0,least(coalesce(p_progress,0),100)),
        updated_at = now()
    where id = p_submission_id
      and submitted_by_user_id = auth.uid()
      and submission_status = 'draft'
      and work_item_id is null
    returning * into row_out;
    if row_out.id is null then raise exception 'Editable draft not found'; end if;
  end if;
  return row_out;
end;
$$;

create or replace function public.submit_form_submission_atomic(
  p_form_template_id uuid,
  p_payload_json jsonb default '{}'::jsonb,
  p_ngo_id uuid default null,
  p_submission_id uuid default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  template_row public.form_templates;
  submission_row public.form_submissions;
  work_item_row public.work_items;
  target_department_id uuid;
  ngo_name text;
  work_title text;
  priority_text text;
  should_sync_trello boolean := false;
  route_key_text text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  if p_idempotency_key is not null then
    select * into submission_row
    from public.form_submissions
    where submitted_by_user_id = auth.uid()
      and idempotency_key = p_idempotency_key
      and submission_status = 'submitted'
    limit 1;
    if submission_row.id is not null then
      return jsonb_build_object(
        'submission', to_jsonb(submission_row),
        'work_item', (
          select to_jsonb(wi) from public.work_items wi where wi.id = submission_row.work_item_id
        ),
        'idempotent_replay', true
      );
    end if;
  end if;

  select * into template_row from public.form_templates
  where id = p_form_template_id and is_active
  for share;
  if template_row.id is null then raise exception 'Active form template not found'; end if;
  if p_ngo_id is not null and not (public.is_internal_user() or public.has_ngo_access(p_ngo_id)) then
    raise exception 'NGO access denied';
  end if;

  if p_submission_id is null then
    insert into public.form_submissions(
      form_template_id, ngo_id, submitted_by_user_id, payload_json,
      submission_status, submitted_at, work_item_id, draft_progress, idempotency_key
    ) values (
      template_row.id, p_ngo_id, auth.uid(), coalesce(p_payload_json,'{}'::jsonb),
      'draft', null, null, 100, nullif(trim(p_idempotency_key),'')
    ) returning * into submission_row;
  else
    select * into submission_row
    from public.form_submissions
    where id = p_submission_id
      and submitted_by_user_id = auth.uid()
      and submission_status = 'draft'
      and work_item_id is null
    for update;
    if submission_row.id is null then raise exception 'Editable draft not found'; end if;
    update public.form_submissions
    set form_template_id = template_row.id,
        ngo_id = p_ngo_id,
        payload_json = coalesce(p_payload_json,'{}'::jsonb),
        draft_progress = 100,
        idempotency_key = nullif(trim(p_idempotency_key),''),
        updated_at = now()
    where id = submission_row.id
    returning * into submission_row;
  end if;

  target_department_id := null;
  if (template_row.mapping_json #>> '{work_item,defaults,department_id}') ~*
     '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    select id into target_department_id from public.org_units
    where id = (template_row.mapping_json #>> '{work_item,defaults,department_id}')::uuid;
  end if;
  target_department_id := coalesce(
    target_department_id,
    public.resolve_work_item_department(template_row.module)
  );
  if target_department_id is null then
    raise exception 'No active department route is configured for module %', template_row.module;
  end if;

  if p_ngo_id is not null then
    select coalesce(common_name, legal_name) into ngo_name from public.ngos where id = p_ngo_id;
  end if;
  work_title := template_row.name || case when ngo_name is not null then ' — ' || ngo_name else '' end;

  priority_text := lower(coalesce(
    nullif(p_payload_json->>'priority',''),
    nullif(template_row.mapping_json #>> '{work_item,defaults,priority}',''),
    'medium'
  ));
  if priority_text not in ('low','medium','high') then priority_text := 'medium'; end if;

  select exists(
    select 1 from public.trello_route_mappings tr
    where tr.is_active and tr.department_module = template_row.module::text
  ) into should_sync_trello;

  insert into public.work_items(
    ngo_id, module, type, title, description, department_id,
    owner_user_id, created_by_user_id, status, priority,
    evidence_required, external_visible, trello_sync,
    source_system, source_event_id
  ) values (
    p_ngo_id,
    template_row.module,
    'form_submission',
    work_title,
    nullif(coalesce(p_payload_json->>'summary', p_payload_json->>'description'),'')::text,
    target_department_id,
    null,
    auth.uid(),
    'not_started',
    priority_text::public.priority_level,
    case lower(coalesce(template_row.mapping_json #>> '{work_item,defaults,evidence_required}','false'))
      when 'true' then true when '1' then true when 'yes' then true else false end,
    case lower(coalesce(template_row.mapping_json #>> '{work_item,defaults,external_visible}','false'))
      when 'true' then true when '1' then true when 'yes' then true else false end,
    should_sync_trello,
    'form_submission',
    submission_row.id::text
  ) returning * into work_item_row;

  update public.form_submissions
  set work_item_id = work_item_row.id,
      submission_status = 'submitted',
      submitted_at = now(),
      submitted_version = coalesce(template_row.version,1),
      locked_at = now(),
      updated_at = now()
  where id = submission_row.id
  returning * into submission_row;

  if should_sync_trello then
    select tr.route_key into route_key_text
    from public.trello_route_mappings tr
    where tr.is_active and tr.department_module = template_row.module::text
    order by tr.created_at limit 1;

    insert into public.trello_sync_queue(
      idempotency_key, work_item_id, entity_type, entity_id, operation,
      direction, route_key, payload, status
    ) values (
      'form-submission:' || submission_row.id::text || ':create-card',
      work_item_row.id,
      'work_item',
      work_item_row.id::text,
      'create_card',
      'supabase_to_trello',
      route_key_text,
      jsonb_build_object(
        'title', work_item_row.title,
        'description', work_item_row.description,
        'department_module', template_row.module::text,
        'source_table', 'form_submissions',
        'source_record_id', submission_row.id,
        'ngo_id', p_ngo_id
      ),
      'pending'
    ) on conflict (idempotency_key) do nothing;
  end if;

  insert into public.audit_log(
    actor_user_id, action_type, entity_type, entity_id, reason, after_json
  ) values (
    auth.uid(), 'submit', 'form_submission', submission_row.id,
    'Atomic form submission and department work-item routing',
    jsonb_build_object(
      'work_item_id', work_item_row.id,
      'department_id', target_department_id,
      'module', template_row.module,
      'trello_queued', should_sync_trello
    )
  );

  return jsonb_build_object(
    'submission', to_jsonb(submission_row),
    'work_item', to_jsonb(work_item_row),
    'idempotent_replay', false
  );
end;
$$;

revoke all on function public.save_form_draft(uuid,jsonb,uuid,uuid,smallint) from public, anon;
grant execute on function public.save_form_draft(uuid,jsonb,uuid,uuid,smallint) to authenticated;
revoke all on function public.submit_form_submission_atomic(uuid,jsonb,uuid,uuid,text) from public, anon;
grant execute on function public.submit_form_submission_atomic(uuid,jsonb,uuid,uuid,text) to authenticated;

-- ---------------------------------------------------------------------------
-- Documents: repair uploader/department delete permissions
-- ---------------------------------------------------------------------------

-- Storage paths begin with an NGO UUID. Use the canonical NGO-access helper
-- instead of requiring a contacts row, which previously rejected valid NGO
-- portal accounts with a storage RLS violation.
create or replace function public.can_access_ngo_storage_object(object_name text)
returns boolean
language sql
security definer
stable
set search_path = public, storage
as $$
  select public.is_internal_user()
    or (
      split_part(object_name, '/', 1) ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and public.has_ngo_access(split_part(object_name, '/', 1)::uuid)
    );
$$;

revoke all on function public.can_access_ngo_storage_object(text) from public, anon;
grant execute on function public.can_access_ngo_storage_object(text) to authenticated;

-- An NGO portal upload with no linked work item is routed automatically. This
-- keeps the portal simple while guaranteeing that the responsible department
-- receives the document in its queue.
create or replace function public.route_ngo_portal_document_upload()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_module public.module_type;
  created_work_item_id uuid;
begin
  if new.work_item_id is not null or new.ngo_id is null then return new; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = new.uploaded_by_user_id
      and p.role in ('ngo_user','external_ngo')
  ) then return new; end if;

  target_module := case new.category::text
    when 'finance' then 'finance'::public.module_type
    when 'hr' then 'hr'::public.module_type
    when 'marketing' then 'marketing'::public.module_type
    when 'communications' then 'communications'::public.module_type
    when 'program' then 'program'::public.module_type
    when 'curriculum' then 'curriculum'::public.module_type
    when 'it' then 'it'::public.module_type
    when 'legal' then 'legal'::public.module_type
    when 'compliance' then 'legal'::public.module_type
    else 'ngo_coordination'::public.module_type
  end;

  insert into public.work_items(
    ngo_id, module, type, title, description, department_id,
    created_by_user_id, status, priority, evidence_required,
    evidence_status, external_visible, source_system, source_event_id
  ) values (
    new.ngo_id,
    target_module,
    'ngo_document_upload',
    'Review NGO upload — ' || new.file_name,
    'An NGO portal user uploaded a document for departmental review.',
    public.resolve_work_item_department(target_module),
    new.uploaded_by_user_id,
    'not_started',
    'medium',
    true,
    'uploaded',
    true,
    'ngo_portal_document',
    new.id::text
  ) returning id into created_work_item_id;

  new.work_item_id := created_work_item_id;
  return new;
end;
$$;

drop trigger if exists trg_route_ngo_portal_document_upload on public.documents;
create trigger trg_route_ngo_portal_document_upload
before insert on public.documents
for each row execute function public.route_ngo_portal_document_upload();

drop policy if exists "View documents by NGO access" on public.documents;
drop policy if exists "Internal users can upload documents" on public.documents;
drop policy if exists "Users can upload documents for accessible NGOs" on public.documents;
drop policy if exists "Management can update documents" on public.documents;
drop policy if exists "Super admin can delete documents" on public.documents;
drop policy if exists "External can upload to own NGO" on public.documents;

create policy "Users read accessible documents"
on public.documents for select to authenticated
using (
  public.is_admin_user()
  or uploaded_by_user_id = auth.uid()
  or public.is_internal_user()
  or (ngo_id is not null and public.has_ngo_access(ngo_id))
);

create policy "Users upload accessible documents"
on public.documents for insert to authenticated
with check (
  uploaded_by_user_id = auth.uid()
  and (
    public.is_internal_user()
    or (ngo_id is not null and public.has_ngo_access(ngo_id))
  )
);

create policy "Users update accessible documents"
on public.documents for update to authenticated
using (
  public.is_admin_user()
  or uploaded_by_user_id = auth.uid()
  or public.is_internal_user()
)
with check (
  public.is_admin_user()
  or uploaded_by_user_id = auth.uid()
  or public.is_internal_user()
);

create policy "Uploaders and admins delete documents"
on public.documents for delete to authenticated
using (public.is_admin_user() or uploaded_by_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Trello inbound sync support
-- ---------------------------------------------------------------------------

alter table public.trello_route_mappings
  add column if not exists completed_list_id text;

create table if not exists public.trello_member_mappings (
  trello_member_id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  trello_username text,
  is_active boolean not null default true,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.integration_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_event_id text not null,
  event_type text not null,
  status text not null default 'received'
    check (status in ('received','processed','ignored','failed')),
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  unique(provider, external_event_id)
);

alter table public.trello_member_mappings enable row level security;
alter table public.integration_webhook_events enable row level security;
create policy "Internal users read Trello member mappings"
  on public.trello_member_mappings for select to authenticated
  using (public.is_internal_user());
create policy "Admins manage Trello member mappings"
  on public.trello_member_mappings for all to authenticated
  using (public.is_admin_user()) with check (public.is_admin_user());
create policy "Admins read integration webhook events"
  on public.integration_webhook_events for select to authenticated
  using (public.is_admin_user());

create or replace function public.queue_workspace_work_item_trello_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare operation_name text;
declare payload_body jsonb;
declare route_key_text text;
begin
  -- Inbound Trello changes stamp last_external_sync_at. Do not send those same
  -- changes back out to Trello and create a webhook echo loop.
  if tg_op = 'UPDATE'
     and new.last_external_sync_at is distinct from old.last_external_sync_at then
    return new;
  end if;

  -- Initial opt-in creates a card. Once a card is linked, completion and
  -- assignment-relevant changes update that same card.
  if tg_op = 'INSERT'
     and new.trello_sync
     and new.trello_card_id is null
     and coalesce(new.source_system,'workspace') <> 'form_submission' then
    operation_name := 'create_card';
  elsif tg_op = 'UPDATE'
     and new.trello_sync
     and not coalesce(old.trello_sync,false)
     and new.trello_card_id is null then
    operation_name := 'create_card';
  elsif tg_op = 'UPDATE'
     and new.trello_card_id is not null
     and (
       new.status is distinct from old.status
       or new.owner_user_id is distinct from old.owner_user_id
       or new.title is distinct from old.title
       or new.description is distinct from old.description
       or new.due_date is distinct from old.due_date
     ) then
    operation_name := 'update_card';
  else
    return new;
  end if;

  select tr.route_key into route_key_text
  from public.trello_route_mappings tr
  where tr.is_active and tr.department_module = new.module::text
  order by tr.created_at limit 1;

  payload_body := jsonb_build_object(
    'title', new.title,
    'description', new.description,
    'department_module', new.module::text,
    'card_id', new.trello_card_id,
    'closed', new.status = 'complete',
    'due_date', new.due_date,
    'owner_user_id', new.owner_user_id,
    'route_key', route_key_text
  );

  insert into public.trello_sync_queue(
    idempotency_key, work_item_id, entity_type, entity_id, operation,
    direction, route_key, payload, status
  ) values (
    'work-item:' || new.id::text || ':' || operation_name || ':v' || new.sync_version::text,
    new.id, 'work_item', new.id::text, operation_name,
    'supabase_to_trello', route_key_text, payload_body, 'pending'
  ) on conflict (idempotency_key) do nothing;

  return new;
end;
$$;

create or replace function public.bump_work_item_sync_version()
returns trigger language plpgsql set search_path = public
as $$
begin
  if new.trello_sync is distinct from old.trello_sync
     or new.status is distinct from old.status
     or new.owner_user_id is distinct from old.owner_user_id
     or new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.due_date is distinct from old.due_date then
    new.sync_version := old.sync_version + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bump_work_item_sync_version on public.work_items;
create trigger trg_bump_work_item_sync_version
before update on public.work_items
for each row execute function public.bump_work_item_sync_version();

drop trigger if exists trg_queue_workspace_work_item_trello_change on public.work_items;
drop trigger if exists trg_queue_workspace_work_item_trello_insert on public.work_items;
drop trigger if exists trg_queue_workspace_work_item_trello_update on public.work_items;
create trigger trg_queue_workspace_work_item_trello_insert
after insert on public.work_items
for each row execute function public.queue_workspace_work_item_trello_change();
create trigger trg_queue_workspace_work_item_trello_update
after update of trello_sync, status, owner_user_id, title, description, due_date
on public.work_items
for each row execute function public.queue_workspace_work_item_trello_change();

-- ---------------------------------------------------------------------------
-- Finance access alignment and canonical account creation
-- ---------------------------------------------------------------------------

create or replace function public.is_finance_ledger_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(auth.uid(), 'super_admin')
    or public.has_role(auth.uid(), 'admin_pm')
    or public.has_role(auth.uid(), 'vp_finance')
    or exists (
      select 1 from public.profiles p
      left join public.org_units ou on ou.id = p.department_id
      where p.id = auth.uid()
        and (
          p.role in ('super_admin','admin_pm','vp_finance')
          or (
            lower(trim(coalesce(ou.department_name,''))) = 'finance'
            and (
              p.role = 'department_lead'
              or public.org_rank_level(p.org_rank) >= 60
            )
          )
        )
    );
$$;

create or replace function public.is_finance_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_finance_ledger_manager()
    or exists (
      select 1 from public.profiles p
      join public.org_units ou on ou.id = p.department_id
      where p.id = auth.uid()
        and lower(trim(ou.department_name)) = 'finance'
        and p.role not in ('ngo_user','external_ngo')
    )
    or exists (
      select 1
      from public.department_memberships dm
      join public.org_units ou on ou.id = dm.department_id
      where dm.user_id = auth.uid() and dm.is_active
        and lower(trim(ou.department_name)) = 'finance'
    );
$$;

create or replace function public.can_write_finance_drafts()
returns boolean language sql stable security definer set search_path = public
as $$ select public.is_finance_staff(); $$;

create or replace function public.can_read_finance_ledger()
returns boolean language sql stable security definer set search_path = public
as $$ select public.is_finance_staff(); $$;

create or replace function public.create_finance_account(
  p_code text,
  p_name text,
  p_account_type public.finance_account_type,
  p_account_subtype text default null,
  p_parent_account_id uuid default null,
  p_normal_balance public.finance_normal_balance default 'debit',
  p_is_active boolean default true,
  p_is_cash_account boolean default false,
  p_entity_scope text default 'hpg_operating',
  p_revenue_restriction_class text default null,
  p_expense_functional_class text default null,
  p_form_990_line text default null,
  p_financial_statement_line text default null
)
returns public.finance_accounts
language plpgsql
security definer
set search_path = public
as $$
declare row_out public.finance_accounts;
begin
  if auth.uid() is null or not public.is_finance_ledger_manager() then
    raise exception 'Finance manager access required to create accounts';
  end if;
  if nullif(trim(p_code),'') is null then raise exception 'Account code is required'; end if;
  if nullif(trim(p_name),'') is null then raise exception 'Account name is required'; end if;
  if exists(select 1 from public.finance_accounts where lower(code) = lower(trim(p_code))) then
    raise exception 'Account code % already exists', trim(p_code);
  end if;
  if p_parent_account_id is not null and not exists(
    select 1 from public.finance_accounts where id = p_parent_account_id
  ) then raise exception 'Parent account not found'; end if;

  insert into public.finance_accounts(
    code, name, account_type, account_subtype, parent_account_id,
    normal_balance, is_active, is_cash_account, entity_scope,
    revenue_restriction_class, expense_functional_class,
    form_990_line, financial_statement_line
  ) values (
    trim(p_code), trim(p_name), p_account_type, nullif(trim(p_account_subtype),''),
    p_parent_account_id, p_normal_balance, p_is_active, p_is_cash_account,
    p_entity_scope, p_revenue_restriction_class, p_expense_functional_class,
    nullif(trim(p_form_990_line),''), nullif(trim(p_financial_statement_line),'')
  ) returning * into row_out;

  perform public.finance_log_audit_event(
    'finance_account', row_out.id, 'created',
    jsonb_build_object('code',row_out.code,'name',row_out.name,'account_type',row_out.account_type)
  );
  return row_out;
end;
$$;

revoke all on function public.is_finance_ledger_manager() from public, anon;
revoke all on function public.is_finance_staff() from public, anon;
revoke all on function public.can_write_finance_drafts() from public, anon;
revoke all on function public.can_read_finance_ledger() from public, anon;
grant execute on function public.is_finance_ledger_manager() to authenticated;
grant execute on function public.is_finance_staff() to authenticated;
grant execute on function public.can_write_finance_drafts() to authenticated;
grant execute on function public.can_read_finance_ledger() to authenticated;
revoke all on function public.create_finance_account(
  text,text,public.finance_account_type,text,uuid,public.finance_normal_balance,
  boolean,boolean,text,text,text,text,text
) from public, anon;
grant execute on function public.create_finance_account(
  text,text,public.finance_account_type,text,uuid,public.finance_normal_balance,
  boolean,boolean,text,text,text,text,text
) to authenticated;

-- Users can maintain their international/profile preferences without changing
-- role, department, manager, or any other authorization-bearing field.
grant update (
  full_name, avatar_url, job_title, timezone, preferred_language,
  country_code, phone, bio
) on public.profiles to authenticated;

comment on function public.submit_form_submission_atomic(uuid,jsonb,uuid,uuid,text)
  is 'Atomically locks a private draft, creates exactly one department-routed work item, links the submission, and queues configured integrations.';
comment on table public.department_memberships
  is 'Primary and additional department access used by queues and server-side RLS.';
comment on table public.integration_webhook_events
  is 'Idempotency and audit ledger for inbound Trello, Make, Slack, Gmail, and other integration events.';

-- Monthly technology-usage evidence for the IT-owned audit function.
create table if not exists public.system_usage_monthly_reports (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('google_drive','confluence','slack','trello')),
  reporting_month date not null,
  status text not null default 'pending'
    check (status in ('pending','imported','analyzed','reviewed','exception')),
  metrics jsonb not null default '{}'::jsonb,
  findings jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  source_url text,
  imported_at timestamptz,
  analyzed_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, reporting_month),
  check (reporting_month = date_trunc('month', reporting_month)::date)
);

alter table public.system_usage_monthly_reports enable row level security;
drop policy if exists "Technology reads monthly usage audits"
  on public.system_usage_monthly_reports;
create policy "Technology reads monthly usage audits"
  on public.system_usage_monthly_reports for select to authenticated
  using (
    public.is_admin_user()
    or public.is_department_member(public.resolve_work_item_department('it'::public.module_type))
  );
drop policy if exists "Technology manages monthly usage audits"
  on public.system_usage_monthly_reports;
create policy "Technology manages monthly usage audits"
  on public.system_usage_monthly_reports for all to authenticated
  using (
    public.is_admin_user()
    or public.is_department_member(public.resolve_work_item_department('it'::public.module_type))
  )
  with check (
    public.is_admin_user()
    or public.is_department_member(public.resolve_work_item_department('it'::public.module_type))
  );

insert into public.system_usage_monthly_reports(provider, reporting_month, status)
select provider, date_trunc('month', current_date)::date, 'pending'
from unnest(array['google_drive','confluence','slack','trello']) provider
on conflict (provider, reporting_month) do nothing;

comment on table public.system_usage_monthly_reports
  is 'IT-owned monthly usage, security, adoption, and exception analysis for Google Drive, Confluence, Slack, and Trello.';

-- Calendar taxonomy required by the cross-department operating calendar.
alter type public.calendar_event_type add value if not exists 'grant_submission';
alter type public.calendar_event_type add value if not exists 'event';
alter type public.calendar_event_type add value if not exists 'holiday';
alter type public.calendar_event_type add value if not exists 'milestone';
alter type public.calendar_event_type add value if not exists 'department_goal';
alter type public.calendar_event_type add value if not exists 'fundraiser';

alter table public.calendar_events
  add column if not exists is_all_day boolean not null default false,
  add column if not exists recurrence_rule text,
  add column if not exists importance text not null default 'normal';

alter table public.calendar_events drop constraint if exists calendar_events_importance_check;
alter table public.calendar_events add constraint calendar_events_importance_check
  check (importance in ('normal','important','critical'));
