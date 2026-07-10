# HPG Agent OS Runtime Foundation

Status: **design approved; runtime implementation in progress**  
Primary pilot: **Nia Okafor — Deputy Director, NGO Program Support & Coordination**  
Supabase project: `HPG Application Database`  
Operating model: **supervised autonomous operations**

## Purpose

This foundation turns the existing HPG Agent OS identities, folders, and reporting hierarchy into an auditable production runtime. It provides a permanent case layer across sponsorship, volunteers, board candidates, NGOs, department requests, emails, forms, and agent-generated work.

## Implemented in the runtime migration

Migration: `20260710041000_agent_os_runtime_foundation.sql`

### Universal case registry

`case_registry` stores:

- permanent HPG reference number;
- case type and source record;
- linked NGO, person, department, owner, and supervisor;
- workflow stage, status, priority, risk, and match confidence;
- approval requirement and external visibility;
- Drive, Trello, Gmail, and Confluence references;
- next action, due time, unmatched reason, and review timestamps.

### Permanent reference numbers

`next_hpg_reference_number()` generates annual identifiers:

- `NGO-YYYY-0001` for NGO inquiries and sponsorship cases;
- `VOL-YYYY-0001` for volunteer applicants;
- `BRD-YYYY-0001` for board applicants;
- `IT-YYYY-0001`, `FIN-YYYY-0001`, and `ADM-YYYY-0001` for department requests;
- `CASE-YYYY-0001` as a controlled fallback.

The first NGO reference remains the permanent NGO profile number throughout review, agreement, activation, onboarding, monitoring, and closure.

### Stage history

`case_stage_history` preserves workflow and status transitions rather than overwriting history. A database trigger records changes to the case registry.

### Agent run log

`agent_runs` records the agent, trigger, case, work item, systems consulted, sources, confidence, approval, communication status, records changed, result, error, retries, and supervisor.

### Controlled communication queue

`communication_queue` supports three authority levels:

1. `automatic`
2. `draft_for_review`
3. `human_only`

It includes idempotency keys, review state, send state, retry tracking, source context, and external message identifiers. Creating a queue record does not send an email by itself.

### Trello synchronization queue

`trello_sync_queue` stores idempotent Supabase-to-Trello and Trello-to-Supabase operations. It is ready for the future connector but does not assume a Trello board structure or credential.

### Existing table extensions

`work_items` receives case linkage, reference number, workflow stage, supervisor, source event, confidence, risk, next action, Trello workspace/board/list identifiers, and last-agent-run time.

`ngos` receives the permanent HPG profile number, master Drive folder, activation time, confirmation-letter time, and onboarding-fee verification time.

## Security model

New Agent OS tables enable RLS immediately.

- Internal authenticated users may read and perform authorized inserts and updates.
- Only super administrators may delete case or queue records.
- The reference counter is inaccessible directly and is used through a security-definer function.
- Service-role workflows retain backend access.
- External NGO portal users are not granted access to internal Agent OS case, run, communication, or Trello queues.

## Existing security remediation still required

The production database currently reports RLS disabled on:

- `transaction_number_counters`
- `profiles`
- `ngos`
- `hr_email_outbox`

Policies already exist for some of these tables, but RLS activation must be tested before production because enabling it can change application access. This remediation is intentionally separate from the runtime migration.

## Nia Okafor pilot

The Drive workspace now contains:

- Operating SOP & Playbook
- Source of Truth Map
- Intake Classification Rules
- Working Context State Schema
- Automation & Trigger Map
- Handoff & Escalation Matrix
- QA Evaluation Rubric
- Run Log & Audit Schema

### Pilot scenarios

1. Routine NGO document receipt and checklist update.
2. Low-confidence unmatched intake routed internally without an automatic sender clarification.
3. Sensitive NGO complaint requiring human review.
4. Finance request handed off with a complete packet.
5. Overdue NGO report using the approved escalation schedule.
6. Automation failure after three attempts.
7. Program reporting through Nia → Yakubu → Amina → Noemi → CEO.

### Pass standard

- no critical failure;
- correct identity and case linkage;
- complete context review;
- approved communication authority;
- evidence attached;
- human approval observed;
- audit record complete;
- supervisor governance confirmed.

## Runtime schedule

- Business hours: Monday–Friday, 8:00 AM–6:00 PM ET.
- Intake and workflow scans: every 15 minutes.
- Routine external response target: within one business hour.
- Specialist report: 1:00 PM ET.
- Director synthesis: 2:30 PM ET.
- VP report: 4:00 PM ET.
- Noemi CEO brief: 5:00 PM ET.
- Urgent events: immediate internal escalation.

## Deployment gates

1. Review migration against a disposable Supabase branch or local database.
2. Generate updated Supabase TypeScript types.
3. Build case registry, communication queue, run log, and unmatched queue hooks.
4. Add staff-facing Agent OS queue pages.
5. Configure Gmail intake and Resend delivery.
6. Inventory Trello workspaces, boards, lists, templates, custom fields, and Butler automations.
7. Implement Trello synchronization worker.
8. Install Slack webhook secrets and delivery worker.
9. Run the Nia pilot scenarios.
10. Obtain Technology and Program supervisor sign-off.
11. Deploy a limited live pilot.
12. Replicate the approved runtime across all departments.

## Non-goals of the foundation migration

The migration does not:

- send emails;
- create Trello cards;
- alter existing Trello structures;
- approve applicants or sponsorships;
- transfer money;
- sign agreements;
- change Board authority;
- activate RLS on legacy tables without policy testing;
- expose internal case information to NGO portal users.
