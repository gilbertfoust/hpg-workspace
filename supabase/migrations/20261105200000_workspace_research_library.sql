-- Internal HPG evidence library for research workflow training and collaboration.
-- Never confuses a linked citation with an independently verified source.

create table if not exists public.workspace_research_sources (
  id uuid primary key default gen_random_uuid(),
  title text not null check(length(btrim(title)) between 5 and 300),
  authors text not null default '',
  publisher text not null default '',
  source_url text not null check(source_url ~* '^https://[^[:space:]]+$'),
  source_type text not null check(source_type in('primary','secondary','peer_reviewed','dataset','policy','archival','other')),
  published_on date,
  accessed_on date not null default current_date,
  language_code text not null default 'en' check(language_code in('en','es','fr','pt','other')),
  source_summary text not null check(length(btrim(source_summary))>=40),
  methodology_notes text not null default '',
  limitations text not null default '',
  relevance_notes text not null default '',
  access_scope text not null default 'internal' check(access_scope in('internal','restricted')),
  status text not null default 'draft' check(status in('draft','submitted','reviewed','withdrawn')),
  version integer not null default 1 check(version>=1),
  created_by uuid not null references auth.users(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists workspace_research_sources_status_idx
  on public.workspace_research_sources(status,created_at desc);

create table if not exists public.workspace_research_annotations (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.workspace_research_sources(id) on delete restrict,
  annotation_type text not null check(annotation_type in('citation','finding','context','limitation','hypothesis')),
  locator text not null default '',
  note_text text not null check(length(btrim(note_text))>=20),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists workspace_research_annotations_source_idx
  on public.workspace_research_annotations(source_id,created_at);

create table if not exists public.workspace_research_reviews (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.workspace_research_sources(id) on delete restrict,
  source_version integer not null,
  decision text not null check(decision in('verified','needs_revision','rejected')),
  evidence_note text not null check(length(btrim(evidence_note))>=20),
  reviewed_by uuid not null references auth.users(id) on delete restrict,
  reviewed_at timestamptz not null default now()
);

alter table public.workspace_research_sources enable row level security;
alter table public.workspace_research_annotations enable row level security;
alter table public.workspace_research_reviews enable row level security;
revoke all on public.workspace_research_sources from public,anon,authenticated;
revoke all on public.workspace_research_annotations from public,anon,authenticated;
revoke all on public.workspace_research_reviews from public,anon,authenticated;
grant select on public.workspace_research_sources to authenticated;
grant select on public.workspace_research_annotations to authenticated;
grant select on public.workspace_research_reviews to authenticated;

create policy "Scoped internal staff read reviewed research citations"
on public.workspace_research_sources for select to authenticated
using (
  (select public.is_internal_user()) and (
    (status='reviewed' and access_scope='internal')
    or created_by=(select auth.uid())
    or (select public.is_admin_user())
  )
);

create policy "Internal staff read notes on authorized research"
on public.workspace_research_annotations for select to authenticated
using (
  (select public.is_internal_user())
  and exists (
    select 1 from public.workspace_research_sources source
    where source.id=source_id
  )
);

create policy "Original researcher and admins read private review history"
on public.workspace_research_reviews for select to authenticated
using (
  (select public.is_internal_user())
  and exists(
    select 1 from public.workspace_research_sources source
    where source.id=source_id
  )
);

create or replace function public.create_workspace_research_source(
  p_title text,p_authors text,p_publisher text,p_url text,p_source_type text,
  p_summary text,p_methodology text,p_limitations text,p_relevance text,
  p_scope text default 'internal',p_language text default 'en',p_published_on date default null
) returns uuid language plpgsql security definer set search_path=''
as $$
declare created uuid;
begin
  if (select auth.uid()) is null or not (select public.is_internal_user()) then
    raise exception 'Approved HPG research staff required' using errcode='42501';
  end if;
  if length(btrim(coalesce(p_title,'')))<5
    or p_url !~* '^https://[^[:space:]]+$'
    or p_source_type not in('primary','secondary','peer_reviewed','dataset','policy','archival','other')
    or length(btrim(coalesce(p_summary,'')))<40
    or p_scope not in('internal','restricted')
    or p_language not in('en','es','fr','pt','other') then
    raise exception 'A full title, HTTPS source, classified type, 40-character summary and permitted scope are required'
      using errcode='23514';
  end if;
  insert into public.workspace_research_sources(
    title,authors,publisher,source_url,source_type,
    source_summary,methodology_notes,limitations,relevance_notes,
    access_scope,language_code,published_on,created_by
  ) values(
    btrim(p_title),btrim(coalesce(p_authors,'')),btrim(coalesce(p_publisher,'')),
    btrim(p_url),p_source_type,btrim(p_summary),btrim(coalesce(p_methodology,'')),
    btrim(coalesce(p_limitations,'')),btrim(coalesce(p_relevance,'')),
    p_scope,p_language,p_published_on,(select auth.uid())
  ) returning id into created;
  return created;
end;
$$;

create or replace function public.submit_workspace_research_source(p_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare target public.workspace_research_sources;
begin
  if (select auth.uid()) is null or not (select public.is_internal_user()) then
    raise exception 'Approved HPG research staff required' using errcode='42501';
  end if;
  select * into target from public.workspace_research_sources where id=p_id for update;
  if not found or target.created_by<>(select auth.uid()) or target.status<>'draft' then
    raise exception 'Only the author can submit an eligible draft source' using errcode='42501';
  end if;
  if length(btrim(target.source_summary))<40 then
    raise exception 'Source summary must support an independent review' using errcode='23514';
  end if;
  update public.workspace_research_sources
  set status='submitted',updated_at=now() where id=p_id;
  return true;
end;
$$;

create or replace function public.add_workspace_research_annotation(
  p_source_id uuid,p_kind text,p_locator text,p_note text
) returns uuid language plpgsql security definer set search_path=''
as $$
declare source_row public.workspace_research_sources;created uuid;
begin
  if (select auth.uid()) is null or not (select public.is_internal_user()) then
    raise exception 'Approved HPG research staff required' using errcode='42501';
  end if;
  if p_kind not in('citation','finding','context','limitation','hypothesis')
    or length(btrim(coalesce(p_note,'')))<20 then
    raise exception 'A valid annotation category and documented explanation are required' using errcode='23514';
  end if;
  select * into source_row from public.workspace_research_sources where id=p_source_id;
  if not found or not (
    (source_row.status='reviewed' and source_row.access_scope='internal')
    or source_row.created_by=(select auth.uid())
    or (select public.is_admin_user())
  ) then
    raise exception 'Source is not available for annotation' using errcode='42501';
  end if;
  insert into public.workspace_research_annotations(
    source_id,annotation_type,locator,note_text,created_by
  ) values(p_source_id,p_kind,left(btrim(coalesce(p_locator,'')),240),btrim(p_note),(select auth.uid()))
  returning id into created;
  return created;
end;
$$;

create or replace function public.review_workspace_research_source(
  p_source_id uuid,p_decision text,p_note text
) returns boolean language plpgsql security definer set search_path=''
as $$
declare target public.workspace_research_sources;
begin
  if (select auth.uid()) is null or not (select public.is_admin_user()) then
    raise exception 'Independent authorized HPG research reviewer required' using errcode='42501';
  end if;
  if p_decision not in('verified','needs_revision','rejected')
    or length(btrim(coalesce(p_note,'')))<20 then
    raise exception 'Document the review decision and evidence' using errcode='23514';
  end if;
  select * into target from public.workspace_research_sources
    where id=p_source_id for update;
  if not found or target.status<>'submitted' then
    raise exception 'Only submitted sources are eligible for review' using errcode='23514';
  end if;
  if target.created_by=(select auth.uid()) then
    raise exception 'The source author cannot approve their own research citation' using errcode='42501';
  end if;
  insert into public.workspace_research_reviews(
    source_id,source_version,decision,evidence_note,reviewed_by
  ) values(
    p_source_id,target.version,p_decision,btrim(p_note),(select auth.uid())
  );
  update public.workspace_research_sources set
    status=case when p_decision='verified' then 'reviewed'
           when p_decision='needs_revision' then 'draft'
           else 'withdrawn' end,
    reviewed_by=(select auth.uid()),reviewed_at=now(),updated_at=now()
  where id=p_source_id;
  return true;
end;
$$;

create or replace function public.revise_workspace_research_draft(
  p_source_id uuid,p_summary text,p_methodology text,p_limitations text,p_relevance text
) returns boolean language plpgsql security definer set search_path=''
as $$
declare target public.workspace_research_sources;
begin
  if (select auth.uid()) is null or not (select public.is_internal_user()) then
    raise exception 'Approved HPG research staff required' using errcode='42501';
  end if;
  if length(btrim(coalesce(p_summary,'')))<40 then
    raise exception 'Research summary requires at least forty characters' using errcode='23514';
  end if;
  select * into target from public.workspace_research_sources where id=p_source_id for update;
  if not found or target.created_by<>(select auth.uid()) or target.status<>'draft' then
    raise exception 'Only the original author can revise their draft' using errcode='42501';
  end if;
  update public.workspace_research_sources set
    source_summary=btrim(p_summary),methodology_notes=btrim(coalesce(p_methodology,'')),
    limitations=btrim(coalesce(p_limitations,'')),relevance_notes=btrim(coalesce(p_relevance,'')),
    version=version+1,updated_at=now()
  where id=p_source_id;
  return true;
end;
$$;

revoke all on function public.create_workspace_research_source(text,text,text,text,text,text,text,text,text,text,text,date)
from public,anon,authenticated;
revoke all on function public.submit_workspace_research_source(uuid)
from public,anon,authenticated;
revoke all on function public.add_workspace_research_annotation(uuid,text,text,text)
from public,anon,authenticated;
revoke all on function public.review_workspace_research_source(uuid,text,text)
from public,anon,authenticated;
revoke all on function public.revise_workspace_research_draft(uuid,text,text,text,text)
from public,anon,authenticated;
grant execute on function public.create_workspace_research_source(text,text,text,text,text,text,text,text,text,text,text,date) to authenticated;
grant execute on function public.submit_workspace_research_source(uuid) to authenticated;
grant execute on function public.add_workspace_research_annotation(uuid,text,text,text) to authenticated;
grant execute on function public.review_workspace_research_source(uuid,text,text) to authenticated;
grant execute on function public.revise_workspace_research_draft(uuid,text,text,text,text) to authenticated;
comment on table public.workspace_research_sources is
  'Internal HPG research source and bibliography library; authorship, methodology, evidence limitations, independent review and privacy scope are explicit.';
