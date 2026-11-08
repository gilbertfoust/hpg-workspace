# HPG Executive Professional Academy — Workspace Training development and acceptance register

**Architecture.** The Executive Professional Academy has five peer divisions:
(1) free internal Workspace Training; (2) NGO Compliance Training;
(3) Volunteer Nonprofit Certification; (4) Fiscal Sponsorship Compliance Training;
(5) Executive Professional Advancement. All use HPG Workspace as a shared
delivery platform. Nothing in this implementation makes the other divisions
children of Workspace Training or authorizes external learner enrollment.

**Scope.** This release implements the **eight software-development phases
of Workspace Training**. The requested final stages of recording actual
instructional videos and testing every live staff role are deferred. Code
deployment is not a finding of training competency, professional accreditation,
Board approval, or integration authorization.

## Software delivery register

| Phase | Implemented foundation | Verification and incomplete dependencies |
|---|---|---|
| 1 — Role learning pathways | 15 internal course rules; automatic assignments on approved profile role, department, job-title, approval and access changes; admin overrides; assignment audit; scoped learner and manager views | Check each future HR/job-title mapping with genuine authorized staff. External NGO accounts cannot receive internal assignments. |
| 2 — Curriculum structure | 15 syllabi with objective, outcomes, provisional duration, prerequisite and assessment; 60 controlled lesson standards with editable evidence and version history | Lesson standards begin `pending`, not approved. Curriculum editors must check source material and departmental processes. |
| 3 — Examinations/remediation | Assignment-scoped quizzes, randomized display order, private server answer keys, 15 exam policies, daily attempt limits, study cooldowns and remediation records after failed attempts | No exam score or supervisor endorsement can be interpreted as accredited qualification. Practical assessments and actual job demonstration belong to final acceptance. |
| 4 — Learning management | Role-specific learner plan, team-scoped due/overdue reports, explicitly assigned deadlines and idempotent private notifications from pg_cron | Notice generation is internal only; no unsolicited external email. No invented due dates. |
| 5 — Access controls | Server-side RLS limits lesson catalog, approved media, syllabi, assessments, and new completion entries to actual assigned courses | Existing operational modules keep their independent role permissions. A course assignment cannot grant system access. |
| 6 — External integrations | Administrator-only evidence dashboard checking actual social channel verification, internal approvals, provider proof, research, Board roster and Academy video assets | HPG social channels are not yet verified/OAuth-connected. Real third-party posting requires developer credentials, exact platform scopes, consent, approval and proof; no fake post or connection. |
| 7 — Languages/accessibility | EN/FR/ES/PT navigation terminology, language selector, device-appropriate narration, approved translation registry for 60 lessons, independent review, English fallback, screen-guide localization and skip-navigation | No translated procedural text is presented as approved until a distinct administrator reviews it. Four-language navigation is not a completed four-language course library. |
| 8 — Automated release validation | Static curriculum checks, TypeScript/lint/build CI, privacy regression SQL, complete migration-replay job with pinned Supabase CLI v2 and operational-page change-impact advisory | Historical clean migration replay passes **only** when the GitHub job reports success. Keep source migrations unchanged, log separate failures, and do not issue a clean-replay claim based solely on direct production SQL smoke tests. |

## Technical boundaries

- **Database:** Supabase project `mlmjlgmsrkemsuwdohsa`.
- **Frontend:** HPG Workspace Vite / React at GitHub Pages.
- **Workflow:** PR CI -> direct connected-database migration + authorization smoke -> GitHub Pages build -> deployment result.
- **Admin training dashboards:** `/learning/plan`, `/learning/curriculum`,
  `/learning/readiness`, `/learning/integrations`, `/learning/translations`;
  knowledge checks `/learning/assessments`.
- **Data security:** user profiles, confirmed roles, Board privileges, and
  database RLS are the source of authorization; browser metadata is not.
- **Board:** real director roster, meeting quorum and motions must be
  governed by approved bylaws. Academy training never casts a director ballot.
- **Media:** the recording studio creates local files by explicit instructor
  permission. An administrator submits instructional references and a separate
  reviewer approves them. Neither a studio URL nor a recording draft proves a
  lesson contains an approved demonstration.

## Evidence gates for acceptance

A course can be considered *software-built* when its routes, role checks, rubric,
curriculum records and CI checks work. It is *training-ready* only after these
additional requirements are met:

1. A current approved tutorial, including any language edition displayed, matches
   the actual live Workspace function.
2. Lesson objectives, prerequisites, permissions and assessments are approved
   by authorized content owners.
3. Required instructor demonstrations have real captions/transcripts and independent
   review in the Academy resource catalog.
4. A real learner in each relevant staff role performs the workflow with their
   own credentials and an independent reviewer logs the observed result.
5. Remaining failures are corrected and retested, without altering genuine
   financial, HR, NGO, media or Board data to simulate success.
6. Final HPG governance/HR sign-off is documented as organizational acceptance.

**Do not mark all eight phases 100% operational while any required provider
connection, translation review, historical database replay, recorded instruction
or real-role acceptance remains unverified.** Final training videos and human
acceptance are intentionally postponed, per direction.

## Phase 8 replay finding — November 8, 2026

The upgraded Supabase CLI (v2.122.1) resolves the earlier false
`BEGIN ATOMIC` parsing error, but a complete clean migration replay **still
does not pass**. A July 17 production-security migration expects
`public.hr_email_outbox` and a September 29 account-approval migration expects
`public.workspace_admin_notification_events`, which are present in the live
project but not created by the earlier source-controlled migrations. The
legacy migrations already applied to production are deliberately left
unchanged here. Issue #150 tracks recovery of a complete, authoritative
schema baseline before full clean-install certification.

Phase 8's automated frontend/build/Academy checks and new database RLS
smoke tests are distinct from full historic migration replay. Passing
these checks **must not** be reported as a successful full clean rebuild.

## External service handoffs

For social providers: identify platform owner -> approve developer application ->
complete official OAuth consent and minimum required scopes -> store credentials
outside the browser -> enforce canonical marketing approvals -> publish by
provider API only after authorization -> reconcile actual provider ID, public
URL and independent evidence. Creating a portal button or an internal
`scheduled` social post is not provider authorization.

For languages: author all instructional steps in target language -> independent
qualified language/context review -> explicit publication -> display reviewed
revision; otherwise show unchanged English with source-language notice.

For Academy credential expansion: design the four other **parallel** divisions
under the Academy, not under Workspace Training; handle eligibility, payment,
certification criteria, legal claims and data isolation separately.

_Last updated for the phases 1–8 software build; validation evidence is the
corresponding PR, CI runs, database migration history and live Academy readiness
report, not this prose alone._
