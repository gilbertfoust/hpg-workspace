# HPG Agent OS — Phase 2 Workflow and Policy Catalog

## Purpose

This phase converts the approved Agent OS operating decisions into database-managed policy records. It builds on `20260710041000_agent_os_runtime_foundation.sql`, which introduced the universal case registry, stage history, agent run log, communication queue, and Trello synchronization queue.

## Added policy tables

- `agent_os_workflow_definitions`
- `agent_os_workflow_stages`
- `agent_os_communication_policies`
- `agent_os_escalation_policies`
- `agent_os_reporting_schedules`
- `agent_os_department_intelligence`

## Sponsorship workflow

The migration encodes the complete sponsorship path from first inquiry through active NGO monitoring. The permanent reference number uses the NGO profile-number format established in the runtime foundation.

The activation gate is enforced in the policy order:

1. Agreement signed
2. Onboarding fee form sent
3. Payment received and verified by Finance
4. Confirmation letter issued
5. Activation processed
6. Transfer to NGO Coordination
7. Onboarding
8. Active sponsored NGO

Human approval remains required for interviews, Development VP approvals, executive or Board review when triggered, General Counsel agreement approval, agreement signature, payment verification, and corrective action or termination.

## Volunteer workflow

The volunteer workflow begins with the website application and supports automatic acknowledgment, résumé collection, completeness review, skills classification, background screening, department recommendation, availability request, offer generation, onboarding, NonprofitReady training assignment, access tasks, orientation, and 30-day review.

Humans retain control over interview scheduling, the interview, acceptance or rejection, department placement, and the underlying decision that triggers the rejection notice. A rejection email may send automatically only after an authorized human places the Trello card in the Rejected list.

## Communication authority

The communication catalog stores three authority levels:

- `automatic`
- `draft_for_review`
- `human_only`

Routine acknowledgments, document requests, receipt confirmations, training instructions, status updates, and approved reminders may send automatically within one business hour. Complaints, misunderstandings, compliance clarification, financial disputes, and relationship-sensitive messages are drafted for review. Meeting confirmation, final legal conclusions, contract negotiation, termination, Board communication, and public statements remain human-only.

## Escalation rules

- Due date reached: assignee reminder
- 1 business day overdue: supervisor and Director notification
- 3 business days overdue: VP notification
- 5 business days overdue: Noemi Vale escalation
- 10 business days overdue: CEO queue when materially important
- Urgent legal, financial, safeguarding, reputational, or NGO-relationship matters bypass the normal schedule

## Reporting schedule

All times use `America/New_York` and apply Monday through Friday:

- Specialist report: 1:00 PM
- Director synthesis: 2:30 PM
- VP department report: 4:00 PM
- Noemi Vale CEO brief: 5:00 PM

The Noemi report remains required on quiet business days and should state “No material changes” while listing approvals, overdue work, watch items, and automation failures.

## Department intelligence catalog

The catalog records the approved executive lead, monitoring scope, standard outputs, and urgent topics for all 12 HPG departments:

1. Administration
2. Finance
3. Development
4. Operations
5. Program
6. Innovation
7. Technology
8. Marketing
9. Communications
10. Human Resources
11. General Counsel
12. Efficiency

## Security

The catalog is readable by internal authenticated users. Policy changes are restricted to super administrators and service-role processes. These tables contain policy and routing data only and must not contain passwords, tokens, webhook secrets, private keys, or other credentials.

## Deployment sequence

1. Review the migration on the feature branch.
2. Run migration lint and a disposable-database test.
3. Verify `is_internal_user()` and `is_super_admin()` exist in the target project.
4. Apply the runtime foundation migration first.
5. Apply the workflow-policy catalog migration.
6. Regenerate Supabase TypeScript types.
7. Add administrative screens for the policy catalog.
8. Connect workflow processors to the catalog rather than hard-coded stage arrays.
9. Run sponsorship and volunteer sandbox cases.
10. Activate connectors only after credential and security review.
