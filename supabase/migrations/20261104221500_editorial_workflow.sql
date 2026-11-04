-- HPG Communications editorial workflow — versioned, role-gated and non-public by default.
-- This is a repository migration. Do not execute it against a mismatched Supabase project.
-- Approval and publication recording are atomic RPC operations, not client-controlled status writes.

create or replace function public.can_write_editorial()
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null
    and (select public.is_internal_user())
    and (
      (select public.is_admin_user())
      or exists (
        select 1
        from public.profiles p
        left join public.org_units u on u.id = p.department_id
        where p.id = (select auth.uid())
          and (
            p.role::text = 'vp_communications'
            or lower(coalesce(u.department_name, '') || ' ' || coalesce(u.sub_department_name, ''))
               ~ '(communication|editorial|media)'
          )
      )
      or exists (
        select 1 from public.department_memberships dm
        join public.org_units ou on ou.id = dm.department_id
        where dm.user_id = (select auth.uid()) and dm.is_active
          and lower(coalesce(ou.department_name, '') || ' ' || coalesce(ou.sub_department_name, ''))
              ~ '(communication|editorial|media)'
      )
    );
$$;

create or replace function public.can_approve_editorial()
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null
    and (select public.is_internal_user())
    and (
      (select public.is_admin_user())
      or exists (
        select 1
        from public.profiles p
        left join public.org_units u on u.id = p.department_id
        where p.id = (select auth.uid())
          and (
            p.role::text = 'vp_communications'
            or (
              p.role::text = 'department_lead'
              and lower(coalesce(u.department_name, '') || ' ' || coalesce(u.sub_department_name, ''))
                  ~ '(communication|editorial|media)'
            )
          )
      )
    );
$$;

revoke all on function public.can_write_editorial() from public, anon;
revoke all on function public.can_approve_editorial() from public, anon;
grant execute on function public.can_write_editorial() to authenticated;
grant execute on function public.can_approve_editorial() to authenticated;

create table if not exists public.editorial_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('article','issue','interview','press_release','newsletter','research_brief')),
  title text not null check (length(btrim(title)) between 1 and 240),
  summary text not null default '',
  body_markdown text not null default '',
  status text not null default 'draft' check (status in ('draft','in_review','changes_requested','approved','published','archived')),
  planned_publish_at timestamptz,
  published_at timestamptz,
  published_url text,
  interviewee_name text,
  interview_date timestamptz,
  consent_confirmed boolean not null default false,
  consent_document_id uuid references public.documents(id) on delete set null,
  transcript_document_id uuid references public.documents(id) on delete set null,
  author_id uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  revision integer not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint editorial_publication_url_https check (published_url is null or published_url ~* '^https://[^[:space:]]+$')
);
create index if not exists editorial_items_kind_status_idx on public.editorial_items(kind, status);
create index if not exists editorial_items_planned_at_idx on public.editorial_items(planned_publish_at);
create index if not exists editorial_items_author_idx on public.editorial_items(author_id);

create table if not exists public.editorial_issue_items (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.editorial_items(id) on delete cascade,
  content_id uuid not null references public.editorial_items(id) on delete restrict,
  sort_order integer not null default 0 check (sort_order >= 0),
  added_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(issue_id, content_id),
  check(issue_id <> content_id)
);
create index if not exists editorial_issue_items_order_idx on public.editorial_issue_items(issue_id, sort_order, created_at);

create table if not exists public.editorial_reviews (
  id uuid primary key default gen_random_uuid(),
  editorial_item_id uuid not null references public.editorial_items(id) on delete restrict,
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  decision text not null check (decision in ('approved', 'changes_requested')),
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists editorial_reviews_item_time_idx on public.editorial_reviews(editorial_item_id, created_at desc);

create table if not exists public.editorial_events (
  id uuid primary key default gen_random_uuid(),
  editorial_item_id uuid not null references public.editorial_items(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists editorial_events_item_time_idx on public.editorial_events(editorial_item_id, created_at desc);

-- All editorial records are internal only, including signed consent metadata.
alter table public.editorial_items enable row level security;
alter table public.editorial_issue_items enable row level security;
alter table public.editorial_reviews enable row level security;
alter table public.editorial_events enable row level security;
revoke all on public.editorial_items, public.editorial_issue_items, public.editorial_reviews, public.editorial_events from anon, authenticated;

grant select on public.editorial_items, public.editorial_issue_items, public.editorial_reviews, public.editorial_events to authenticated;
grant insert (kind, title, summary, body_markdown, planned_publish_at, interviewee_name, interview_date, consent_confirmed, consent_document_id, transcript_document_id) on public.editorial_items to authenticated;
grant update (title, summary, body_markdown, planned_publish_at, interviewee_name, interview_date, consent_confirmed, consent_document_id, transcript_document_id) on public.editorial_items to authenticated;
grant insert (issue_id, content_id, sort_order) on public.editorial_issue_items to authenticated;
grant update (sort_order) on public.editorial_issue_items to authenticated;
grant delete on public.editorial_issue_items to authenticated;
grant all on public.editorial_items, public.editorial_issue_items, public.editorial_reviews, public.editorial_events to service_role;

create policy "Editorial staff read editorial items"
on public.editorial_items for select to authenticated using ((select public.can_write_editorial()));

create policy "Editorial staff create drafts"
on public.editorial_items for insert to authenticated
with check (
  (select public.can_write_editorial())
  and author_id = (select auth.uid())
  and status = 'draft'
  and approved_by is null and approved_at is null
  and published_at is null and published_url is null
);

create policy "Editorial staff edit only unapproved copy"
on public.editorial_items for update to authenticated
using ((select public.can_write_editorial()) and status in ('draft','changes_requested'))
with check ((select public.can_write_editorial()) and status in ('draft','changes_requested'));

create policy "Editorial staff read issue contents"
on public.editorial_issue_items for select to authenticated
using ((select public.can_write_editorial()));

create policy "Editorial staff add to open issues"
on public.editorial_issue_items for insert to authenticated
with check (
  (select public.can_write_editorial()) and added_by = (select auth.uid())
  and exists (
    select 1 from public.editorial_items issue
    where issue.id = issue_id and issue.kind = 'issue' and issue.status in ('draft','changes_requested')
  )
  and exists (
    select 1 from public.editorial_items content
    where content.id = content_id and content.kind <> 'issue'
  )
);

create policy "Editorial staff reorder open issues"
on public.editorial_issue_items for update to authenticated
using ((select public.can_write_editorial()) and exists (
  select 1 from public.editorial_items issue where issue.id = issue_id and issue.status in ('draft','changes_requested')
))
with check ((select public.can_write_editorial()) and exists (
  select 1 from public.editorial_items issue where issue.id = issue_id and issue.status in ('draft','changes_requested')
));

create policy "Editorial staff remove from open issues"
on public.editorial_issue_items for delete to authenticated
using ((select public.can_write_editorial()) and exists (
  select 1 from public.editorial_items issue where issue.id = issue_id and issue.status in ('draft','changes_requested')
));

create policy "Editorial staff read review history"
on public.editorial_reviews for select to authenticated using ((select public.can_write_editorial()));

create policy "Editorial staff read workflow events"
on public.editorial_events for select to authenticated using ((select public.can_write_editorial()));

-- Prevent drafts from forging a revision number or update timestamp.
create or replace function public.editorial_touch_draft()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if new.title is distinct from old.title
    or new.summary is distinct from old.summary
    or new.body_markdown is distinct from old.body_markdown
    or new.consent_confirmed is distinct from old.consent_confirmed
    or new.consent_document_id is distinct from old.consent_document_id
    or new.transcript_document_id is distinct from old.transcript_document_id
  then
    new.revision := old.revision + 1;
  end if;
  return new;
end;
$$;
drop trigger if exists editorial_draft_revision on public.editorial_items;
create trigger editorial_draft_revision before update on public.editorial_items
for each row execute function public.editorial_touch_draft();

-- Status transitions only through guarded RPCs; no direct authenticated UPDATE on status.
create or replace function public.submit_editorial_item(p_id uuid)
returns public.editorial_items language plpgsql security definer set search_path = '' as $$
declare
  item public.editorial_items;
  member_count integer;
begin
  if (select auth.uid()) is null or not (select public.can_write_editorial()) then
    raise exception 'Editorial staff access required';
  end if;
  select * into item from public.editorial_items where id = p_id for update;
  if not found or item.status not in ('draft','changes_requested') then
    raise exception 'Item is not editable or does not exist';
  end if;
  if item.kind = 'issue' then
    select count(*) into member_count from public.editorial_issue_items where issue_id = item.id;
    if member_count = 0 then raise exception 'Add at least one article before sending an issue for review'; end if;
  elsif length(btrim(item.body_markdown)) = 0 then
    raise exception 'Add draft content before requesting review';
  end if;
  update public.editorial_items set status='in_review' where id=item.id returning * into item;
  insert into public.editorial_events(editorial_item_id,actor_id,action)
    values(item.id,(select auth.uid()),'submitted_for_review');
  return item;
end;
$$;

create or replace function public.review_editorial_item(p_id uuid, p_decision text, p_note text default '')
returns public.editorial_items language plpgsql security definer set search_path = '' as $$
declare
  item public.editorial_items;
  invalid_issue_items integer;
begin
  if (select auth.uid()) is null or not (select public.can_approve_editorial()) then
    raise exception 'Editorial reviewer permission required';
  end if;
  if p_decision not in ('approved','changes_requested') then
    raise exception 'Unsupported review decision';
  end if;
  select * into item from public.editorial_items where id=p_id for update;
  if not found or item.status <> 'in_review' then
    raise exception 'Item is not awaiting review';
  end if;
  if item.author_id = (select auth.uid()) then
    raise exception 'A different authorized reviewer must approve the creator''s work';
  end if;
  if p_decision = 'approved' then
    if item.kind='interview' and (not item.consent_confirmed or item.consent_document_id is null) then
      raise exception 'Interview approval requires documented consent';
    end if;
    if item.kind='issue' then
      select count(*) into invalid_issue_items
      from public.editorial_issue_items m
      join public.editorial_items child on child.id=m.content_id
      where m.issue_id=item.id and child.status not in ('approved','published');
      if invalid_issue_items > 0 then
        raise exception 'Every issue contribution must be approved before the issue can be approved';
      end if;
    end if;
  elsif length(btrim(coalesce(p_note,''))) = 0 then
    raise exception 'Explain what changes are requested';
  end if;
  update public.editorial_items
    set status=p_decision,
        approved_by=case when p_decision='approved' then (select auth.uid()) else null end,
        approved_at=case when p_decision='approved' then now() else null end
    where id=p_id returning * into item;
  insert into public.editorial_reviews(editorial_item_id,reviewer_id,decision,note)
    values(p_id,(select auth.uid()),p_decision,left(coalesce(p_note,''),4000));
  insert into public.editorial_events(editorial_item_id,actor_id,action,detail)
    values(p_id,(select auth.uid()),p_decision,jsonb_build_object('note',left(coalesce(p_note,''),4000)));
  return item;
end;
$$;

-- Publication is an audited record of an EXTERNAL action, not a social/website posting API.
create or replace function public.record_editorial_publication(p_id uuid, p_url text)
returns public.editorial_items language plpgsql security definer set search_path = '' as $$
declare item public.editorial_items;
begin
  if (select auth.uid()) is null or not (select public.can_approve_editorial()) then
    raise exception 'Editorial publisher permission required';
  end if;
  if p_url is null or p_url !~* '^https://[^[:space:]]+$' then
    raise exception 'Enter a valid HTTPS URL for the published release';
  end if;
  select * into item from public.editorial_items where id=p_id for update;
  if not found or item.status <> 'approved' or item.approved_by is null then
    raise exception 'Content must be approved before its publication is recorded';
  end if;
  update public.editorial_items
    set status='published',published_at=now(),published_url=p_url
    where id=p_id returning * into item;
  insert into public.editorial_events(editorial_item_id,actor_id,action,detail)
    values(p_id,(select auth.uid()),'publication_recorded',jsonb_build_object('url',p_url));
  return item;
end;
$$;

revoke all on function public.submit_editorial_item(uuid) from public, anon;
revoke all on function public.review_editorial_item(uuid,text,text) from public, anon;
revoke all on function public.record_editorial_publication(uuid,text) from public, anon;
grant execute on function public.submit_editorial_item(uuid) to authenticated;
grant execute on function public.review_editorial_item(uuid,text,text) to authenticated;
grant execute on function public.record_editorial_publication(uuid,text) to authenticated;

comment on table public.editorial_items is 'Communications editorial queue. Publication status can only be recorded after a separate authorized review.';
comment on column public.editorial_items.consent_document_id is 'Document record referencing signed/authorized interview consent; private to editorial staff.';
comment on column public.editorial_items.published_url is 'Proof of an externally published release, not a command to publish.';
