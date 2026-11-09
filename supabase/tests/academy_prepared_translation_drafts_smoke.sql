-- Disposable database only. Roll back the test accounts and translation.
begin;

do $$
declare
  author_id uuid := gen_random_uuid();
  reviewer_id uuid := gen_random_uuid();
  draft_title text := 'Brouillon pour le test de traduction';
  draft_goal text := 'Vérifier le circuit de révision indépendante.';
  draft_steps jsonb := '["Ouvrez le tableau de bord.", "Repérez le menu latéral.", "Retournez à l’Académie."]';
  draft_practice text := 'Repérez le tableau de bord et le lien de retour.';
begin
  -- The historical signup trigger cannot supply the required profile role in
  -- a fresh replay. Build explicit test identities within this transaction.
  alter table auth.users disable trigger on_auth_user_created;
  insert into auth.users(id, email) values
    (author_id, author_id || '@example.invalid'),
    (reviewer_id, reviewer_id || '@example.invalid');
  alter table auth.users enable trigger on_auth_user_created;
  insert into public.profiles(id, email, full_name, role) values
    (author_id, author_id || '@example.invalid', 'Academy test author', 'admin_pm'),
    (reviewer_id, reviewer_id || '@example.invalid', 'Academy test reviewer', 'admin_pm');

  insert into public.academy_lesson_translations (
    lesson_id, language_code, translated_title, translated_objective,
    translated_steps, translated_practice
  ) values ('welcome', 'fr', draft_title, draft_goal, draft_steps, draft_practice);

  begin
    update public.academy_lesson_translations set status = 'reviewed'
      where lesson_id = 'welcome' and language_code = 'fr';
    raise exception 'The database allowed an unassigned draft to become reviewed';
  exception when check_violation then
    null;
  end;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', author_id, 'role', 'authenticated')::text, true);
  begin
    perform public.review_academy_lesson_translation('welcome', 'fr', 'publish');
    raise exception 'An administrator published an unassigned draft';
  exception when insufficient_privilege then
    if sqlerrm <> 'An administrator must save the prepared draft before review' then
      raise;
    end if;
  end;

  perform public.save_academy_lesson_translation('welcome', 'fr', draft_title, draft_goal, draft_steps, draft_practice);
  begin
    perform public.review_academy_lesson_translation('welcome', 'fr', 'publish');
    raise exception 'A draft author was allowed to approve their own translation';
  exception when insufficient_privilege then
    if sqlerrm <> 'A translator cannot approve their own lesson translation' then
      raise;
    end if;
  end;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', reviewer_id, 'role', 'authenticated')::text, true);
  perform public.review_academy_lesson_translation('welcome', 'fr', 'publish');
  if not exists (
    select 1 from public.academy_lesson_translations t
    where t.lesson_id = 'welcome' and t.language_code = 'fr' and t.status = 'reviewed'
      and t.authored_by = author_id and t.reviewed_by = reviewer_id and t.version = 2
  ) then
    raise exception 'Adoption and independent review did not preserve draft authorship';
  end if;
end;
$$;

rollback;
select 'academy_prepared_translation_drafts_passed' as result;
