-- Prepared translations can wait for an administrator to take responsibility
-- for the text. No user identity is assigned to an externally prepared draft.
alter table public.academy_lesson_translations
  alter column authored_by drop not null,
  add constraint academy_translation_author_required_for_review
    check (authored_by is not null or (status = 'draft' and reviewed_by is null and reviewed_at is null));

comment on column public.academy_lesson_translations.authored_by is
  'NULL denotes a prepared private draft. An Academy administrator must save the draft under their own account before a different administrator can publish it.';

create or replace function public.review_academy_lesson_translation(
  p_lesson text, p_language text, p_action text
) returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  row_data public.academy_lesson_translations;
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null or not (select public.is_admin_user()) then
    raise exception 'Independent Academy translation reviewer required' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('publish', 'withdraw') then
    raise exception 'Invalid translation review action' using errcode = '22023';
  end if;
  select * into row_data from public.academy_lesson_translations
  where lesson_id = p_lesson and language_code = p_language for update;
  if not found then
    raise exception 'Translation not found' using errcode = 'P0002';
  end if;
  if p_action = 'publish' and row_data.authored_by is null then
    raise exception 'An administrator must save the prepared draft before review' using errcode = '42501';
  end if;
  if p_action = 'publish' and row_data.authored_by = actor_id then
    raise exception 'A translator cannot approve their own lesson translation' using errcode = '42501';
  end if;
  if (p_action = 'publish' and row_data.status <> 'draft') or
     (p_action = 'withdraw' and row_data.status <> 'reviewed') then
    raise exception 'Translation is not eligible for this review action' using errcode = '23514';
  end if;
  update public.academy_lesson_translations
  set status = case when p_action = 'publish' then 'reviewed' else 'withdrawn' end,
      reviewed_by = actor_id, reviewed_at = now(), updated_at = now()
  where lesson_id = p_lesson and language_code = p_language;
  return true;
end;
$$;
