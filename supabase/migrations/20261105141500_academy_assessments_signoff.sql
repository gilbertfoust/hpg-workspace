-- Role-specific Learning Academy knowledge checks and independent supervisor signoff.
-- Protected answer keys stay in private schema; results are not professional
-- certifications or substitutes for direct observation of job performance.

create table if not exists public.academy_assessments (
  assessment_id text primary key,
  track_id text not null,
  title text not null,
  passing_percent integer not null check(passing_percent between 1 and 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.academy_assessments enable row level security;

create table if not exists private.academy_assessment_questions (
  question_id text primary key,
  assessment_id text not null references public.academy_assessments(assessment_id) on delete restrict,
  position integer not null check(position>0),
  prompt text not null,
  options jsonb not null check(jsonb_typeof(options)='array' and jsonb_array_length(options)=4),
  correct_index integer not null check(correct_index between 0 and 3),
  unique(assessment_id,position)
);
alter table private.academy_assessment_questions enable row level security;
revoke all on private.academy_assessment_questions from public,anon,authenticated;

insert into public.academy_assessments(assessment_id,track_id,title,passing_percent,is_active)
values
('start','start','Workspace Essentials',80,true),
('communications','communications','Communications and Editorial Safety',80,true),
('marketing','marketing','Marketing Campaign Operations',80,true),
('grants','grants','Development and Grants Review',80,true),
('research','research','Research Source Integrity',80,true),
('budget','budget','Finance and Budget Controls',80,true),
('accounting','accounting','Accounting Evidence and Reconciliation',80,true),
('board','board','Board Governance and Voting',80,true)
on conflict(assessment_id) do update set title=excluded.title,track_id=excluded.track_id,passing_percent=excluded.passing_percent;

insert into private.academy_assessment_questions(question_id,assessment_id,position,prompt,options,correct_index)
values
('start-1','start',1,'What should you do before updating an unfamiliar NGO or staff record?','["Edit it to practice","Confirm your role, record context, and assigned responsibility","Send it outside HPG for feedback","Change the status to complete"]'::jsonb,1),
('start-2','start',2,'What does a Learning Academy completion currently mean?','["Professional certification","Independent demonstration of competence","Self-reported completion of practice","Authorization to approve grants"]'::jsonb,2),
('start-3','start',3,'Where should you check work assigned specifically to you?','["My Queue","Public Publications","Donations page","Media rights register"]'::jsonb,0),
('communications-1','communications',1,'What is required before releasing an interview to a public audience?','["A planned publication date alone","An uploaded audio file","Current editorial approvals and verified subject consent","A task marked complete"]'::jsonb,2),
('communications-2','communications',2,'Who may clear rights for a newly uploaded media asset?','["Its uploader","A separately authorized reviewer","Any NGO applicant","An anonymous visitor"]'::jsonb,1),
('communications-3','communications',3,'Why is an internal magazine proof different from a public edition?','["A proof automatically emails subscribers","A proof is for review and does not authorize release","A proof bypasses rights checks","A proof is always public"]'::jsonb,1),
('marketing-1','marketing',1,'What does a social post''s Scheduled status establish?','["That an external platform posted it","That external login credentials have been verified","An internal planned time, not verified external publication","That Finance has approved all spending"]'::jsonb,2),
('marketing-2','marketing',2,'Where should a social post be associated with a campaign or registered platform?','["Marketing Operations","Board voting","Financial reconciliation","NGO contract signature"]'::jsonb,0),
('marketing-3','marketing',3,'What must happen before publishing creative material that uses a beneficiary''s image?','["No review if it is a good cause","Confirm rights and consent evidence plus required approvals","Add a hashtag","Save a private draft"]'::jsonb,1),
('grants-1','grants',1,'Does saving a grant draft authorize sending the application?','["Yes, when its title is complete","Only if a donor asks","No, submission requires its authorized review and decision","Yes, if the NGO logo is attached"]'::jsonb,2),
('grants-2','grants',2,'What should a development officer check before entering an NGO grant commitment?','["The NGO''s verified identity, program budget, and approvals","Only public social comments","Only the filename","A future event date"]'::jsonb,0),
('grants-3','grants',3,'What is an appropriate distinction in sponsorship communications?','["Any local contribution must bypass documentation","An unapproved budget is already a disbursement","Overhead sharing should be stated separately from program expenses","Signed contracts are optional for disbursements"]'::jsonb,2),
('research-1','research',1,'What is the strongest practice for citing a research claim?','["Separate primary evidence from later interpretation and document the source","Cite only a persuasive headline","Remove contradictory results","Rely on an unverified paraphrase"]'::jsonb,0),
('research-2','research',2,'What should happen when a source cannot be verified?','["Present it as established fact","Identify the uncertainty and request or locate evidence","Delete the audit history","Assign the conclusion to another author"]'::jsonb,1),
('research-3','research',3,'What makes a research upload appropriate for a shared workspace?','["Clear source attribution and permitted access","Public release by default","No metadata","A private source shared without consent"]'::jsonb,0),
('budget-1','budget',1,'Does an approved-looking spreadsheet itself authorize a transfer?','["Yes","No; authorization and evidence must follow the finance workflow","Only when uploaded by a volunteer","Yes if it includes a logo"]'::jsonb,1),
('budget-2','budget',2,'What should accompany a proposed NGO expenditure before funds are sent?','["A detailed aligned budget and applicable authorization","Only a text message","No supporting information","A social campaign"]'::jsonb,0),
('budget-3','budget',3,'How should operational receipts be handled?','["Deleted after reimbursement","Uploaded as supporting evidence for reconciliation","Published on public NGO pages","Replaced with unverified estimates"]'::jsonb,1),
('accounting-1','accounting',1,'What should staff do with an unmatched reconciliation item?','["Erase it","Investigate supporting statements and escalate under established controls","Mark it reconciled without evidence","Publish it in social media"]'::jsonb,1),
('accounting-2','accounting',2,'What is essential when reviewing receipts?','["Verify the related account, NGO, transaction, and period","Only check handwriting","Assume every image is valid","Ignore foreign-currency details"]'::jsonb,0),
('accounting-3','accounting',3,'Why should a financial report indicate its reporting period and source?','["To make the report longer","To support traceability and distinguish approved records from forecasts","To grant spending authority","To avoid oversight"]'::jsonb,1),
('board-1','board',1,'Who is eligible to vote on a live Board meeting motion?','["Any website visitor","An eligible current director with recorded attendance under the Board process","Anyone with a public link","Any NGO applicant"]'::jsonb,1),
('board-2','board',2,'What must be satisfied before a Board motion is closed and determined?','["A single favorable comment","Recorded quorum and applicable voting threshold","An unsigned social poll","The chair''s draft"]'::jsonb,1),
('board-3','board',3,'How do approved Board meeting actions enter HPG''s work tracking?','["Automatically as unapproved public announcements","Through the authorized meeting action process linked to approved minutes and a work item","By modifying accounting records","Without an assigned owner"]'::jsonb,1)
on conflict(question_id) do update set prompt=excluded.prompt,options=excluded.options,correct_index=excluded.correct_index;

create table if not exists public.academy_assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assessment_id text not null references public.academy_assessments(assessment_id),
  score integer not null check(score>=0),
  total integer not null check(total>0),
  passing_percent integer not null check(passing_percent between 1 and 100),
  passed boolean not null,
  answers jsonb not null,
  submitted_at timestamptz not null default now(),
  check(score<=total)
);
create index if not exists academy_attempt_user_idx on public.academy_assessment_attempts(user_id,assessment_id,submitted_at desc);
alter table public.academy_assessment_attempts enable row level security;

create table if not exists public.academy_competency_signoffs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assessment_id text not null references public.academy_assessments(assessment_id),
  attempt_id uuid not null references public.academy_assessment_attempts(id) on delete restrict,
  supervisor_user_id uuid not null references auth.users(id),
  decision text not null check(decision in('endorsed','needs_practice')),
  evidence_note text not null check(length(btrim(evidence_note))>=10),
  signed_at timestamptz not null default now(),
  check(user_id<>supervisor_user_id)
);
create index if not exists academy_signoff_user_idx on public.academy_competency_signoffs(user_id,assessment_id,signed_at desc);
alter table public.academy_competency_signoffs enable row level security;

revoke all on public.academy_assessments from public,anon,authenticated;
revoke all on public.academy_assessment_attempts from public,anon,authenticated;
revoke all on public.academy_competency_signoffs from public,anon,authenticated;
grant select on public.academy_assessments to authenticated;
grant select on public.academy_assessment_attempts to authenticated;
grant select on public.academy_competency_signoffs to authenticated;

create policy "Academy learners read available assessments"
on public.academy_assessments for select to authenticated
using ((select public.can_participate_in_academy()));

create policy "Academy learners read only own attempted results"
on public.academy_assessment_attempts for select to authenticated
using ((select public.can_participate_in_academy()) and user_id=(select auth.uid()));

create policy "Academy learners read their own manager endorsements"
on public.academy_competency_signoffs for select to authenticated
using ((select public.can_participate_in_academy()) and user_id=(select auth.uid()));

-- Verify restricted Board-track context via a live Board membership and
-- staff manager access to make the governance quiz meaningful.
create or replace function private.academy_assessment_eligible(p_assessment text)
returns boolean language sql stable security definer set search_path=''
as $$
  select (select public.can_participate_in_academy())
  and exists(select 1 from public.academy_assessments a where a.assessment_id=p_assessment and a.is_active)
  and (
    p_assessment<>'board' or (select public.can_read_bod_meetings())
  );
$$;

create or replace function public.get_academy_assessment(p_assessment text)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare paper public.academy_assessments;
begin
  if not private.academy_assessment_eligible(p_assessment) then
    raise exception 'Assessment unavailable for this learner' using errcode='42501';
  end if;
  select * into paper from public.academy_assessments where assessment_id=p_assessment;
  return jsonb_build_object(
    'id',paper.assessment_id,'title',paper.title,'track_id',paper.track_id,
    'passing_percent',paper.passing_percent,
    'questions',coalesce((select jsonb_agg(jsonb_build_object(
      'id',q.question_id,'prompt',q.prompt,'options',q.options
    ) order by q.position) from private.academy_assessment_questions q
    where q.assessment_id=p_assessment),'[]'::jsonb)
  );
end;
$$;

create or replace function public.submit_academy_assessment(
  p_assessment text,p_answers jsonb
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare q record;correct integer:=0;total integer:=0;result public.academy_assessment_attempts;
  passing integer;percentage integer;chosen jsonb;
begin
  if not private.academy_assessment_eligible(p_assessment) then
    raise exception 'Assessment unavailable for this learner' using errcode='42501';
  end if;
  if p_answers is null or jsonb_typeof(p_answers)<>'object' then
    raise exception 'Submit one selected option per question' using errcode='22023';
  end if;
  if (select count(*) from public.academy_assessment_attempts a
    where a.user_id=(select auth.uid()) and a.assessment_id=p_assessment
      and a.submitted_at>now()-interval '24 hours')>=10 then
    raise exception 'The daily practice-attempt limit has been reached' using errcode='23514';
  end if;
  select passing_percent into passing from public.academy_assessments
  where assessment_id=p_assessment;
  for q in select question_id,correct_index from private.academy_assessment_questions
    where assessment_id=p_assessment order by position loop
    total:=total+1;
    chosen:=p_answers->q.question_id;
    if chosen is null or jsonb_typeof(chosen)<>'number'
      or chosen::text !~ '^[0-3]$' then
      raise exception 'Each question needs one valid response (0-3)' using errcode='22023';
    end if;
    if (chosen::text)::integer=q.correct_index then correct:=correct+1; end if;
  end loop;
  if total=0 or (select count(*) from jsonb_object_keys(p_answers))<>total then
    raise exception 'Question set is incomplete or has unknown identifiers' using errcode='22023';
  end if;
  percentage:=(100*correct)/total;
  insert into public.academy_assessment_attempts
    (user_id,assessment_id,score,total,passing_percent,passed,answers)
  values ((select auth.uid()),p_assessment,correct,total,passing,percentage>=passing,p_answers)
  returning * into result;
  return jsonb_build_object('id',result.id,'score',correct,'total',total,
    'percent',percentage,'passed',result.passed,'submitted_at',result.submitted_at);
end;
$$;

create or replace function public.signoff_academy_assessment(
  p_user_id uuid,p_assessment text,p_decision text,p_note text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare attempt public.academy_assessment_attempts;
  signoff public.academy_competency_signoffs;
begin
  if (select auth.uid()) is null or not (select public.is_internal_user()) then
    raise exception 'Authorized HPG supervisor required' using errcode='42501';
  end if;
  if (select auth.uid())=p_user_id then
    raise exception 'Supervisors cannot sign off their own assessments' using errcode='42501';
  end if;
  if not ((select public.is_admin_user()) or exists(
    select 1 from public.profiles p
    where p.id=p_user_id and p.is_approved and p.access_status='active'
      and (p.supervisor_user_id=(select auth.uid()) or p.manager_user_id=(select auth.uid()))
  )) then
    raise exception 'Direct reporting relationship or authorized administrator required' using errcode='42501';
  end if;
  if p_decision not in('endorsed','needs_practice')
    or length(btrim(coalesce(p_note,'')))<10 then
    raise exception 'Specify an endorsement or practice request with supporting evidence' using errcode='23514';
  end if;
  select * into attempt from public.academy_assessment_attempts a
    where a.user_id=p_user_id and a.assessment_id=p_assessment
    order by a.submitted_at desc,a.id desc limit 1;
  if not found then raise exception 'No learner assessment is available for review' using errcode='23514'; end if;
  if p_decision='endorsed' and not attempt.passed then
    raise exception 'A passing knowledge check is required for endorsement' using errcode='23514';
  end if;
  insert into public.academy_competency_signoffs
    (user_id,assessment_id,attempt_id,supervisor_user_id,decision,evidence_note)
  values(p_user_id,p_assessment,attempt.id,(select auth.uid()),p_decision,btrim(p_note))
  returning * into signoff;
  return jsonb_build_object('id',signoff.id,'decision',signoff.decision,
    'signed_at',signoff.signed_at,'user_id',p_user_id,'assessment_id',p_assessment);
end;
$$;

create or replace function public.get_academy_assessment_team()
returns table(user_id uuid,assessment_id text,assessment_title text,
  attempt_id uuid,score integer,total integer,passed boolean,submitted_at timestamptz,
  signoff_decision text,signoff_note text,signoff_at timestamptz,supervisor_name text)
language sql stable security definer set search_path=''
as $$
  select p.id,a.assessment_id,a.title,attempt.id,attempt.score,attempt.total,
    attempt.passed,attempt.submitted_at,signoff.decision,signoff.evidence_note,
    signoff.signed_at,reviewer.full_name
  from public.profiles p
  cross join public.academy_assessments a
  left join lateral(
    select t.id,t.score,t.total,t.passed,t.submitted_at
    from public.academy_assessment_attempts t
    where t.user_id=p.id and t.assessment_id=a.assessment_id
    order by t.submitted_at desc,t.id desc limit 1
  ) attempt on true
  left join lateral(
    select s.decision,s.evidence_note,s.signed_at,s.supervisor_user_id
    from public.academy_competency_signoffs s
    where s.user_id=p.id and s.assessment_id=a.assessment_id
      and s.attempt_id=attempt.id
    order by s.signed_at desc,s.id desc limit 1
  ) signoff on true
  left join public.profiles reviewer on reviewer.id=signoff.supervisor_user_id
  where (select auth.uid()) is not null
    and (select public.is_internal_user())
    and p.id<>(select auth.uid())
    and p.is_approved and p.access_status='active'
    and p.role not in('ngo_user','external_ngo')
    and ((select public.is_admin_user())
      or p.supervisor_user_id=(select auth.uid())
      or p.manager_user_id=(select auth.uid()))
    and (attempt.id is not null or signoff.decision is not null)
  order by p.id,a.track_id,a.title;
$$;

revoke all on function public.get_academy_assessment(text) from public,anon,authenticated;
revoke all on function public.submit_academy_assessment(text,jsonb) from public,anon,authenticated;
revoke all on function public.signoff_academy_assessment(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.get_academy_assessment_team() from public,anon,authenticated;
grant execute on function public.get_academy_assessment(text) to authenticated;
grant execute on function public.submit_academy_assessment(text,jsonb) to authenticated;
grant execute on function public.signoff_academy_assessment(uuid,text,text,text) to authenticated;
grant execute on function public.get_academy_assessment_team() to authenticated;

comment on table public.academy_competency_signoffs is
  'Manager endorsement of observed practice and passing knowledge-check attempt; not external professional certification.';
