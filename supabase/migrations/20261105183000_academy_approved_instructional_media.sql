-- Private staff learning media registry. This does NOT expose private Drive
-- recordings; existing Drive/host access controls still apply. Each lesson's
-- video/reference link needs independent Academy review before learners see it.
create table if not exists public.academy_lesson_resources (
  id uuid primary key default gen_random_uuid(),
  lesson_id text not null references public.academy_lessons(lesson_id) on delete restrict,
  title text not null check(length(btrim(title)) between 5 and 240),
  resource_kind text not null check(resource_kind in ('recorded_demo','guide','reference')),
  source_url text not null check(source_url ~* '^https://[^[:space:]]+$' and length(source_url)<=2000),
  caption_url text check(caption_url is null or caption_url ~* '^https://[^[:space:]]+$'),
  transcript text not null default '',
  language_code text not null default 'en' check(language_code in ('en','fr','pt','es')),
  status text not null default 'draft' check(status in('draft','published','withdrawn')),
  created_by uuid not null references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check(resource_kind <> 'recorded_demo' or length(btrim(transcript))>=30)
);
create index if not exists academy_lesson_resources_lesson_idx
on public.academy_lesson_resources(lesson_id,status,created_at desc);
alter table public.academy_lesson_resources enable row level security;
revoke all on public.academy_lesson_resources from public,anon,authenticated;
grant select on public.academy_lesson_resources to authenticated;

create policy "Learners view only reviewed Academy lesson media"
on public.academy_lesson_resources for select to authenticated
using (
  (status='published' and (select public.can_participate_in_academy()))
  or (select public.is_admin_user())
);

create or replace function public.create_academy_lesson_resource(
  p_lesson_id text,p_title text,p_kind text,p_source_url text,
  p_caption_url text,p_transcript text,p_language_code text default 'en'
) returns uuid language plpgsql security definer set search_path=''
as $$
declare result uuid;
begin
  if (select auth.uid()) is null or not (select public.is_admin_user()) then
    raise exception 'Academy curriculum administrators only' using errcode='42501';
  end if;
  if p_kind not in ('recorded_demo','guide','reference')
    or nullif(btrim(p_title),'') is null
    or length(btrim(p_title))<5
    or p_source_url !~* '^https://[^[:space:]]+$'
    or (nullif(btrim(coalesce(p_caption_url,'')),'') is not null
        and p_caption_url !~* '^https://[^[:space:]]+$')
    or p_language_code not in ('en','fr','pt','es') then
    raise exception 'A valid title, media kind, language and HTTPS links are required' using errcode='23514';
  end if;
  if p_kind='recorded_demo' and length(btrim(coalesce(p_transcript,'')))<30 then
    raise exception 'Recorded demonstrations require an accessible text transcript before review' using errcode='23514';
  end if;
  insert into public.academy_lesson_resources(
    lesson_id,title,resource_kind,source_url,caption_url,transcript,language_code,created_by
  ) values (
    p_lesson_id,btrim(p_title),p_kind,btrim(p_source_url),
    nullif(btrim(coalesce(p_caption_url,'')),''),coalesce(p_transcript,''),
    p_language_code,(select auth.uid())
  ) returning id into result;
  return result;
end;
$$;

create or replace function public.review_academy_lesson_resource(
  p_id uuid,p_decision text
) returns boolean language plpgsql security definer set search_path=''
as $$
declare item public.academy_lesson_resources;
begin
  if (select auth.uid()) is null or not (select public.is_admin_user()) then
    raise exception 'Academy curriculum administrators only' using errcode='42501';
  end if;
  if p_decision not in('publish','withdraw') then
    raise exception 'Unsupported Academy review decision' using errcode='22023';
  end if;
  select * into item from public.academy_lesson_resources where id=p_id for update;
  if not found then raise exception 'Lesson resource not found' using errcode='P0002'; end if;
  if item.created_by=(select auth.uid()) and p_decision='publish' then
    raise exception 'The author cannot approve their own training media' using errcode='42501';
  end if;
  if p_decision='publish' and item.status<>'draft' then
    raise exception 'Only draft resources can be published after independent review' using errcode='23514';
  end if;
  if p_decision='withdraw' and item.status<>'published' then
    raise exception 'Only published resources can be withdrawn' using errcode='23514';
  end if;
  update public.academy_lesson_resources set
    status=case when p_decision='publish' then 'published' else 'withdrawn' end,
    reviewed_by=(select auth.uid()),reviewed_at=now()
  where id=p_id;
  return true;
end;
$$;
revoke all on function public.create_academy_lesson_resource(text,text,text,text,text,text,text)
from public,anon,authenticated;
revoke all on function public.review_academy_lesson_resource(uuid,text)
from public,anon,authenticated;
grant execute on function public.create_academy_lesson_resource(text,text,text,text,text,text,text)
to authenticated;
grant execute on function public.review_academy_lesson_resource(uuid,text)
to authenticated;
comment on table public.academy_lesson_resources is
  'Admin-authored, independently reviewed Workspace Training media references. Private source access remains governed by its provider; no recordings are automatically published.';
