-- Phase 7: reviewed multilingual internal Workspace Training lesson content.
-- Only independent-reviewed translations are exposed to learners. The
-- unchanged English lesson remains the truthful fallback.
create table public.academy_lesson_translations (
  lesson_id text not null references public.academy_lessons(lesson_id) on delete cascade,
  language_code text not null check(language_code in('fr','es','pt')),
  translated_title text not null check(length(btrim(translated_title)) between 5 and 240),
  translated_objective text not null check(length(btrim(translated_objective))>=20),
  translated_steps jsonb not null check(jsonb_typeof(translated_steps)='array'
    and jsonb_array_length(translated_steps) between 1 and 30),
  translated_practice text not null check(length(btrim(translated_practice))>=20),
  status text not null default 'draft' check(status in('draft','reviewed','withdrawn')),
  version integer not null default 1 check(version>=1),
  authored_by uuid not null references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(lesson_id,language_code)
);
create table public.academy_translation_events (
  id bigint generated always as identity primary key,
  lesson_id text not null,
  language_code text not null,
  prior_data jsonb,
  new_data jsonb not null,
  action text not null,
  actor_id uuid,
  occurred_at timestamptz not null default now()
);
alter table public.academy_lesson_translations enable row level security;
alter table public.academy_translation_events enable row level security;
revoke all on public.academy_lesson_translations,public.academy_translation_events
from public,anon,authenticated;
grant select on public.academy_lesson_translations to authenticated;
grant select on public.academy_translation_events to authenticated;
create policy "Learners read only independently approved course translations"
on public.academy_lesson_translations for select to authenticated
using (
  (select public.is_admin_user())
  or (
    status='reviewed' and exists(
      select 1 from public.academy_lessons lesson
      where lesson.lesson_id=academy_lesson_translations.lesson_id
        and (select public.can_view_assigned_academy_track(lesson.track_id))
    )
  )
);
create policy "Administrators read lesson translation history"
on public.academy_translation_events for select to authenticated
using((select public.is_admin_user()));

create or replace function private.audit_academy_translation()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  insert into public.academy_translation_events
    (lesson_id,language_code,prior_data,new_data,action,actor_id)
  values(new.lesson_id,new.language_code,
    case when tg_op='INSERT' then null else to_jsonb(old) end,
    to_jsonb(new),lower(tg_op),(select auth.uid()));
  return new;
end;
$$;
revoke all on function private.audit_academy_translation() from public,anon,authenticated;
create trigger academy_translation_audit
after insert or update on public.academy_lesson_translations
for each row execute function private.audit_academy_translation();

create or replace function public.save_academy_lesson_translation(
  p_lesson text,p_language text,p_title text,p_objective text,
  p_steps jsonb,p_practice text
) returns boolean language plpgsql security definer set search_path=''
as $$
begin
  if (select auth.uid()) is null or not (select public.is_admin_user()) then
    raise exception 'Academy translation author requires administrator access' using errcode='42501';
  end if;
  if p_language not in('fr','es','pt')
    or length(btrim(coalesce(p_title,'')))<5
    or length(btrim(coalesce(p_objective,'')))<20
    or length(btrim(coalesce(p_practice,'')))<20
    or p_steps is null or jsonb_typeof(p_steps)<>'array'
    or jsonb_array_length(p_steps) not between 1 and 30
    or exists(select 1 from jsonb_array_elements(p_steps) element
      where jsonb_typeof(element)<>'string' or length(btrim(element#>>'{}'))<5) then
      raise exception 'Complete, accurate translations are required for every lesson step' using errcode='23514';
  end if;
  if not exists(select 1 from public.academy_lessons where lesson_id=p_lesson) then
    raise exception 'Unknown authored lesson' using errcode='P0002';
  end if;
  insert into public.academy_lesson_translations(
    lesson_id,language_code,translated_title,translated_objective,
    translated_steps,translated_practice,status,authored_by)
  values(p_lesson,p_language,btrim(p_title),btrim(p_objective),
    p_steps,btrim(p_practice),'draft',(select auth.uid()))
  on conflict(lesson_id,language_code) do update set
    translated_title=excluded.translated_title,
    translated_objective=excluded.translated_objective,
    translated_steps=excluded.translated_steps,
    translated_practice=excluded.translated_practice,
    authored_by=(select auth.uid()),reviewed_by=null,reviewed_at=null,
    status='draft',version=public.academy_lesson_translations.version+1,
    updated_at=now();
  return true;
end;
$$;
create or replace function public.review_academy_lesson_translation(
  p_lesson text,p_language text,p_action text
) returns boolean language plpgsql security definer set search_path=''
as $$
declare row_data public.academy_lesson_translations;
begin
  if (select auth.uid()) is null or not (select public.is_admin_user()) then
    raise exception 'Independent Academy translation reviewer required' using errcode='42501';
  end if;
  if p_action not in('publish','withdraw') then
    raise exception 'Invalid translation review action' using errcode='22023';
  end if;
  select * into row_data from public.academy_lesson_translations
    where lesson_id=p_lesson and language_code=p_language for update;
  if not found then raise exception 'Translation not found' using errcode='P0002';end if;
  if p_action='publish' and row_data.authored_by=(select auth.uid()) then
    raise exception 'A translator cannot approve their own lesson translation' using errcode='42501';
  end if;
  if (p_action='publish' and row_data.status<>'draft') or
     (p_action='withdraw' and row_data.status<>'reviewed') then
    raise exception 'Translation is not eligible for this review action' using errcode='23514';
  end if;
  update public.academy_lesson_translations
  set status=case when p_action='publish' then 'reviewed' else 'withdrawn' end,
    reviewed_by=(select auth.uid()),reviewed_at=now(),updated_at=now()
  where lesson_id=p_lesson and language_code=p_language;
  return true;
end;
$$;
revoke all on function public.save_academy_lesson_translation(text,text,text,text,jsonb,text)
from public,anon,authenticated;
revoke all on function public.review_academy_lesson_translation(text,text,text)
from public,anon,authenticated;
grant execute on function public.save_academy_lesson_translation(text,text,text,text,jsonb,text)
to authenticated;
grant execute on function public.review_academy_lesson_translation(text,text,text)
to authenticated;
comment on table public.academy_lesson_translations is
'Reviewed Academy lesson translations; EN source stays authoritative until independently reviewed translations are released.';
