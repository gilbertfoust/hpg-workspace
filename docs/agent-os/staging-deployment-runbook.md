# Agent OS Staged Deployment Runbook

Status: **Code validated; Supabase staging branch authorization required**

This runbook moves the guarded Agent OS runtime from merged code to a controlled HPG test environment. It does not authorize production deployment by itself.

## 1. Create an isolated Supabase development branch

- Confirm the Supabase organization and hourly branch cost with the HPG account owner.
- Create a branch from project `mlmjlgmsrkemsuwdohsa`.
- Confirm that production data is not copied into the branch.
- Record the branch project reference in the Technology deployment log.

## 2. Apply and validate migrations

Expected controls:

- full migration replay completes;
- database lint completes;
- permanent case/profile numbering works;
- U.S. case routes only to the existing U.S. onboarding form;
- Kenyan or other non-U.S. case routes only to the $100 USD international form;
- confirmation letter is blocked before Finance verification;
- revoked invitation cancels its queued communication;
- external NGO portal users cannot read internal Agent OS records;
- only authorized internal roles can create an invitation.

## 3. Deploy Edge Functions to staging

Deploy:

- `process-agent-os-communications`
- `process-agent-os-trello-sync`
- `agent-os-external-form`

The functions use custom server-side authentication. Gateway JWT verification remains disabled only because each function validates an internal JWT or dedicated worker secret itself.

## 4. Install staging secrets

Required:

- `AGENT_OS_WORKER_SECRET`
- staging `RESEND_API_KEY`
- verified staging sender in `AGENT_OS_FROM_EMAIL`
- Trello test API key and token
- test-only Trello route mappings

Keep live gates disabled initially:

- `AGENT_OS_COMMUNICATIONS_LIVE=false`
- `AGENT_OS_TRELLO_LIVE=false`

## 5. Dry-run tests

- create fabricated U.S. and international sponsorship cases;
- move both to agreement-signed;
- verify mutually exclusive fee routes;
- create the international secure invitation;
- confirm only a token hash is stored;
- open the public form with the test token;
- submit the fixed $100 form;
- confirm Finance work item and Trello queue record;
- confirm no email or Trello card was created in dry-run mode;
- verify agent run and stage history records.

## 6. Controlled live-delivery test

After Technology and Finance approve the dry run:

- use a verified HPG test recipient;
- enable communications live gate in staging only;
- send one international invitation;
- confirm delivery;
- confirm case stage moves to form-sent only after provider success;
- replace an unsent invitation and confirm the old communication is cancelled;
- use Trello test board and enable Trello live gate;
- confirm one Finance verification card is created with the correct template/route.

## 7. Nia Okafor pilot

Run the approved scenarios:

1. routine document receipt;
2. unmatched intake;
3. sensitive NGO complaint;
4. Finance handoff;
5. overdue NGO report;
6. third-attempt automation failure;
7. Nia → Yakubu → Amina → Noemi → CEO reporting.

## 8. Sign-off

Required before production merge/deployment:

- Technology: migration, security, credentials, and runtime reliability;
- Finance: $100 USD route, payment method, verification procedure, refund/dispute handling;
- Development: agreement-to-fee handoff and applicant communication;
- Program/NGO Coordination: activation and onboarding handoff;
- General Counsel: agreement and confirmation-letter controls;
- Executive authorization for production activation.

## 9. Production rollout

- merge the validated Supabase branch;
- deploy approved Edge Function versions;
- install production secrets;
- keep live gates disabled;
- run production read-only and dry-run checks;
- enable one workflow at a time;
- monitor the operations console, failed queues, and audit records;
- pause immediately on unauthorized delivery, incorrect jurisdiction, duplicate task creation, or data exposure.
