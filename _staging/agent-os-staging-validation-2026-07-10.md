# Agent OS staging validation — 2026-07-10

## Environment

- Supabase branch: `agent-os-staging`
- Staging project ref: `gvzpeaktuaiqexzzdren`
- Source production project: `mlmjlgmsrkemsuwdohsa`
- Production data copied: **No**
- Live email delivery: **Disabled**
- Live Trello writes: **Disabled**
- Live payment processing: **Disabled**

This file records isolated staging evidence. It is not authorization to promote schema changes or enable external actions.

## Fabricated intake validation

The staging triggers registered three fabricated applications and assigned permanent case references:

| Intake | Reference | Department route | Result |
|---|---|---|---|
| Sponsorship | `NGO-2026-0001` | Development / Partnership Development & Sponsorships | Passed |
| Volunteer | `VOL-2026-0001` | Human Resources / Recruitment | Passed |
| Board | `BRD-2026-0001` | Administration / Nominations Committee Intake | Passed |

The volunteer intake also queued an initial HR acknowledgment in the staging outbox. No external message was sent.

## Communication and external-form controls

Validated with fabricated recipients using `.invalid` addresses:

- automatic routine communications can enter the pending queue;
- a sensitive compliance message remains `draft_for_review`, `pending_review`, and human-review required;
- a simulated external-form delivery state synchronized to the invitation record;
- revoking a second invitation cancelled its unsent communication;
- the database blocked confirmation-letter progression before Finance verification;
- an unmatched email created a low-confidence case in the Unmatched / New Case Queue and prepared a neutral clarification message.

The communication Edge Function was not invoked with live credentials. Queue and trigger behavior were validated at the database layer only.

## Nia Okafor pilot

A staging-only route was registered for:

- Department: Program
- Function: NGO Program Support & Coordination
- Route key: `program.ngo_coordination.handoff`
- Operation: `create_card`

The Nia pilot queue resolves as `ready` against the existing NGO Coordinator board and handoff list. The payload is marked `dry_run=true`; no Trello card was created.

The generic sponsorship, volunteer, and board routes remain `mapping_required` until their approved Trello board/list destinations are entered.

## Trello readiness repair

The original readiness view required an explicit `route_key`, while the live worker also supported department/case fallback resolution. Migration `20260710151056_fix_agent_os_trello_route_readiness_fallback` aligns the dry-run readiness view with the worker and preserves `security_invoker = true`.

The corrected view exposes:

- `requested_route_key`
- `department_module`
- `subdepartment_function`
- `case_type`
- `route_mapping_id`
- `board_id`
- `list_id`
- `template_card_id`
- `route_readiness`

## Type drift review

Fresh TypeScript types were generated directly from staging after the validation migrations. The generated schema contains the expected Agent OS objects, including:

### Tables

- `agent_os_activation_fee_policies`
- `agent_os_external_form_invitations`
- `agent_os_workflow_stages`
- `agent_os_workflow_transitions`
- `case_registry`
- `case_stage_history`
- `communication_queue`
- `agent_runs`
- `trello_route_mappings`
- `trello_sync_queue`

### Views

- `agent_os_case_pipeline`
- `agent_os_external_form_invitation_status`
- `agent_os_trello_route_readiness`
- `agent_os_unlinked_applications`
- `agent_os_unmatched_case_queue`

### Worker and workflow functions

- `claim_agent_os_communications`
- `recover_stale_agent_os_communications`
- `claim_agent_os_trello_sync`
- `recover_stale_agent_os_trello_sync`
- `agent_os_transition_case`
- `agent_os_route_activation_fee`
- `agent_os_verify_activation_fee`

The production client type file was **not** replaced. Staging contains unpromoted schema, so production-generated types must remain the application source of truth until an approved production migration is completed.

For an authorized local staging snapshot:

```bash
supabase gen types typescript \
  --project-id gvzpeaktuaiqexzzdren \
  > _staging/agent-os-staging.types.ts
```

Do not copy this output into `src/integrations/supabase/types.ts` before production promotion.

## Current validation boundaries

Completed:

- fabricated sponsorship, volunteer, and board intake;
- permanent reference generation;
- departmental routing and Trello queue creation;
- routine-versus-sensitive communication authority;
- external-form delivery-state and revocation behavior;
- unmatched intake routing;
- Finance confirmation-letter gate;
- Nia Okafor Trello route dry run;
- staging type generation and drift review.

Still required:

- credentialed Edge Function dry-run invocation by Technology;
- approved Trello mappings for Development, HR, and Nominations;
- Technology, Finance, Development, Program, General Counsel, and Executive sign-off;
- an approved production promotion and rollback plan;
- deletion of the staging branch after validation to stop hourly billing.
