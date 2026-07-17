# HPG Global Fiscal Sponsor Operating System

## Production MVP blueprint and 100% acceptance contract

**Document status:** implementation baseline

**Prepared:** July 2026

**Product scope:** HPG internal operations plus secure service delivery to sponsored NGOs
**Not the goal:** duplicating every NetSuite feature or building functions HPG does not need

## 1. Product outcome

HPG Workspace becomes the operating system for a global fiscal sponsor. It must let HPG market its services, onboard and support sponsored NGOs, receive and reconcile money, run fundraising and grant workflows, manage programs and staff, collect evidence, generate organization-level and consolidated reports, and prepare digital reporting packages for governments or other authorized recipients.

The platform is successful when HPG and every authorized NGO can complete their assigned workflows without relying on an untracked email, spreadsheet, or Trello card as the system of record. Gmail, Slack, Trello, Google Drive, Make.com, Relay, payment providers, and government portals remain connected systems; HPG Workspace remains the authoritative workflow, accounting, evidence, permission, and audit system.

“100%” in this blueprint means every acceptance test in the release matrix passes in the target production environment. It does **not** mean theoretical parity with every edition, add-on, country package, or industry feature sold by NetSuite, QuickBooks, Eventlify, GrantStation, or another vendor.

## 2. Operating principles

1. **One authoritative record.** Every request, submission, transaction, assignment, document, external message, integration event, approval, and filing has a stable Workspace identifier.
2. **Draft is not submit.** A private draft can only be seen by its author and must not create a department work item, Slack notification, or Trello card.
3. **Submission is atomic.** Submit creates or locks the submission and routes exactly one work item in one database transaction. Partial writes are prohibited.
4. **Department privacy by default.** Submitted work is readable by the responsible department, assigned staff, authorized administrators, and explicitly authorized NGO users—not by every staff member.
5. **NGO isolation.** An NGO account can see only its authorized organizations and explicitly shared records.
6. **Double-entry finance.** Operational forms may propose accounting activity, but only valid, balanced, approved journal entries affect financial statements.
7. **Evidence before assertion.** A report or compliance status links to its source transactions, documents, approvals, period, calculation version, and preparer.
8. **Idempotent integrations.** Replayed Gmail, Slack, Trello, Make.com, payment, or government events must not create duplicate records.
9. **Audit instead of silent deletion.** Material business records are completed, voided, archived, or soft-deleted with actor, reason, and timestamp.
10. **Configuration before code forks.** Departments, routes, countries, languages, form templates, account mappings, report schedules, and integration destinations are configuration.
11. **AI assists; people remain accountable.** AI may classify, calculate, draft, reconcile, or detect anomalies. Posting, filing, disbursement, and other material actions follow explicit human approval rules.

## 3. Users and authorization lanes

### 3.1 HPG roles

| Role | Core authority |
|---|---|
| Super Admin | Full platform configuration, audited user/role management, emergency access, soft deletion |
| Admin / PM | Organization administration, work routing, templates, cross-department reporting |
| VP Finance | Chart of accounts, journal approval/posting/voiding, reconciliation, close, consolidated reporting |
| Department VP / Director | Department queues, assignment, approval, goals, dashboards, reporting |
| NGO Coordinator | Sponsored NGO portfolio, onboarding, evidence, requests, reports, service delivery |
| Staff | Own profile and dashboard; assigned and department-authorized work |
| Auditor / Read-only reviewer | Time-bounded, evidence-backed read access; no operational posting |

### 3.2 NGO roles

| Role | Core authority |
|---|---|
| NGO Administrator | Manages NGO users and profile data, sees shared reports, submits authorized requests |
| NGO Finance | Uploads receipts/statements, prepares reports, reviews NGO ledger/report outputs |
| NGO Program | Program and outcome reporting, files, milestones, participant-safe aggregates |
| NGO Development | Grants, campaigns, donors, events, proposals, supporting evidence |
| NGO Viewer | Read-only dashboard and explicitly shared documents/reports |

### 3.3 Authorization invariants

- Role data and department membership are separate. A user may belong to more than one department, with one primary membership.
- Row-level security enforces access in PostgreSQL. Hiding a navigation item is not a security control.
- Finance ledger access is denied to NGO portal roles. NGO users receive controlled views and reports, not internal ledger mutation rights.
- Super Admin, Admin, and VP Finance may manage Finance according to the approved authority matrix.
- Department access is resolved against `org_units`, which is the foreign-key target used by `work_items.department_id`.
- Assignments can be owner, assignee, reviewer, or watcher. Trello membership mappings update those assignments.
- Soft-deleted work items do not appear in operational queues but remain in the database and audit trail.

## 4. Canonical platform objects

| Object | Purpose | Required identifiers |
|---|---|---|
| Profile | User identity, photo, language, timezone, department, title, manager | user UUID |
| Department membership | Primary/additional department access and responsibility | user + org unit |
| NGO | Sponsored organization master record and service relationship | NGO UUID, HPG profile number |
| Contact | People related to an NGO, partner, funder, vendor, or applicant | contact UUID |
| Form template | Versioned schema and mapping into a department workflow | template UUID + version |
| Form submission | Private draft or locked submitted payload | submission UUID + idempotency key |
| Work item | Universal operational assignment and status record | work item UUID + source event |
| Work item assignment | Multi-user responsibility, including Trello-derived assignment | work item + user + role |
| Document | Metadata and secure storage reference | document UUID + object path |
| Evidence requirement | Expected NGO document/report and review state | NGO + requirement |
| Integration event | Inbound idempotency, payload, outcome, error | provider + external event ID |
| Integration queue item | Controlled outbound operation and retry state | queue UUID + idempotency key |
| Account | Canonical chart-of-accounts record | account UUID + unique code |
| Journal entry and line | Balanced, approved accounting event | entry UUID + line UUIDs |
| Financial period | Open/close control and reporting boundary | period UUID |
| Grant / campaign / event | Development pipeline and fundraising delivery | module-specific UUID |
| Filing/report package | Versioned calculated output and delivery evidence | package UUID + reporting period |

## 5. Work intake, forms, and queues

### 5.1 Draft contract

When a user selects **Save draft**:

- Workspace upserts a `form_submissions` row with `submission_status = draft`.
- `submitted_by_user_id` must equal the authenticated user.
- `work_item_id`, `submitted_at`, and `locked_at` remain null.
- `draft_progress` records 0–100 percent completion.
- Only the author can read, update, resume, or delete the draft.
- No work item, Slack notification, Trello card, email, Drive export, or downstream accounting event is created.
- A submitted or locked form cannot be changed back into a draft.

### 5.2 Submit contract

When a user selects **Submit**:

1. The server validates authentication, template status/version, NGO access, and required fields.
2. The server locks the existing private draft or creates the final submission record.
3. The server resolves the department using an explicit template mapping, then the canonical module-to-org-unit route.
4. The server creates exactly one work item with `source_system = form_submission`.
5. The server links the submission and work item, stamps the submitted template version, and locks the submission.
6. The existing department notification trigger queues configured Slack/email notifications.
7. If the module has an active Trello route, one idempotent card-creation operation is queued.
8. The server records the action in the audit log.
9. Every step commits or every step rolls back.

### 5.3 Department routing

| Submitted module/function | Owning hub/department |
|---|---|
| NGO Coordination, Program, Curriculum | Program |
| Partnerships, CRM, Procurement, Grants, Fundraising | Development |
| Marketing | Marketing |
| Communications | Communications |
| HR | Human Resources |
| Finance, Assets, Inventory | Finance |
| Governance, Legal, Compliance | Compliance / Legal |
| IT Operations, system audit | Technology / IT |

The visible work item table can filter by department. Database authorization, not the selected filter, determines which records are returned.

### 5.4 Queue behavior

- **My Queue** includes records where the user is owner, assignee, or reviewer.
- **Department Queue** includes active, non-deleted records routed to any active department membership.
- **Admin Records** receives completed or archived work without losing source history.
- Deadlines show overdue and due-soon states.
- Owners and multi-assignees are separate, so Trello membership does not overwrite historical assignment data.
- Admins can create work items manually and can soft-delete them with an audit reason.

## 6. Trello, Slack, Gmail, Make.com, and Google Drive

### 6.1 Trello two-way synchronization

**Workspace to Trello**

- Manual or form-driven opt-in queues `create_card` using a department route.
- The worker uses a stable idempotency key, retry count, route, template, default labels, and default members.
- Successful creation stores workspace, board, list, card ID, and URL back on the work item/queue record.
- Title, description, due date, owner, and completion changes queue `update_card`.

**Trello to Workspace**

- Webhook requests require the configured webhook secret.
- Every Trello action is recorded by external action ID before processing.
- A card created on an active mapped board/list creates a routed Workspace work item.
- Moving a card into the route’s completed list or closing the card completes the work item.
- Reopening a completed card returns it to in progress.
- Adding a mapped Trello member creates a Workspace assignment and places the item in that user’s My Queue.
- Removing the member removes the Trello-sourced assignment and selects a remaining owner when required.
- `last_external_sync_at` prevents webhook echo loops.

**Configuration required for live use**

- Trello API key/token, webhook secret, public webhook URL, workspace/board/list IDs.
- One `trello_member_mappings` record per participating user.
- One active route per department workflow, including `completed_list_id`.
- `AGENT_OS_TRELLO_LIVE=true` only after dry-run output is approved.

### 6.2 Slack

- Department notification routes hold the display channel and a server-side secret name—not a webhook URL in the browser.
- A submitted form queues a Slack event only after its work item exists.
- Upload routing can queue Slack notification events for the destination department.
- Slack-originated work items enter through an authenticated Make.com route or a future direct Slack Events API adapter using the same integration-event contract.
- Delivery workers record sent, skipped, failed, error, attempt, and processed timestamp.

### 6.3 Gmail

- Gmail/Make.com emits `gmail.work_item` with a stable Gmail message or thread ID.
- Subject becomes work-item title; body/snippet becomes description.
- The configured department/module determines routing.
- Duplicate delivery returns an idempotent replay result.
- The source Gmail identifier stays on the work item and integration ledger.
- Departmental mailbox filters, consent, retention, and allowed senders are deployment configuration.

### 6.4 Make.com

- Supported intake events: generic work item, Gmail work item, Slack work item, Google Drive work item, and department intake.
- Every Make automation has an active flag and independent webhook secret.
- The receiver normalizes department aliases, status, and priority before insert.
- It never writes invalid values such as `status = open` or a nonexistent `department` column.
- The database trigger assigns `department_id` from the normalized module.
- Optional `sync_to_trello` sends the new record into the same controlled Trello queue.

### 6.5 Google Drive

- The NGO card stores the master Drive folder URL and ID.
- Department Drive exports occur only for complete/approved work.
- Source documents remain represented by Workspace metadata even when the binary is stored in Drive or Supabase Storage.
- IT’s monthly audit records Drive usage metrics, findings, recommendations, and source report URL.
- Production must define folder ownership, shared-drive structure, retention, legal hold, and what remains in Supabase versus Drive.

## 7. Profiles and personal staff workspace

Every staff profile includes:

- photo/avatar;
- full name and email;
- job title and department;
- phone, country code, timezone, and preferred language;
- manager and employment status;
- optional biography.

The personal dashboard shows:

- active My Queue count;
- due in seven days and overdue counts;
- completed and created work over the last 30 days;
- 30-day completion rate;
- current-month HR time from timesheets;
- uploaded-document count;
- direct links to queue, HR, and documents.

Users may update only non-authorization profile fields. Role, department, manager, and employment authority remain administrator-controlled.

Initial language choices are English, Spanish, French, Portuguese, Arabic, Swahili, and Bengali. The preference is production-ready profile data; complete translation requires each approved interface message, form template, notification, report label, and right-to-left layout to have a reviewed language pack. No release may claim a translated language from the selector alone.

## 8. NGO portal and coordination

### 8.1 NGO account experience

An authenticated NGO user can:

- see an NGO-scoped dashboard;
- access only authorized NGOs;
- review shared work, requests, deadlines, compliance state, reports, and finance views;
- upload documents and receipts;
- complete assigned forms and periodic reports;
- download approved reports and evidence packages;
- submit finance, program, development, and coordination requests;
- track the state of explicitly shared work items.

An NGO user cannot access internal HPG ledger mutation, other NGO data, internal staff files, unshared work, integration secrets, or system audit records.

### 8.2 NGO uploads

- Binary upload checks storage RLS using the canonical NGO-access function.
- Metadata insert checks the same NGO authorization.
- An unlinked NGO portal upload automatically creates a department-routed review work item.
- Category determines the destination; other/general routes to NGO Coordination.
- The document links to that work item before insert completes.
- Internal reviewers can approve/reject and record notes.
- The uploader can delete their document record; admins can delete any authorized record. Storage cleanup failure does not resurrect the user-facing row.

### 8.3 Missing-items control

For each NGO, Workspace shows:

- every expected evidence requirement;
- received/missing checkbox state;
- development versus NGO-coordinator process;
- priority;
- missing count and high-priority missing count;
- review status and last activity;
- responsible department and optional work item.

Portfolio sorting prioritizes high-risk NGOs, high-priority missing items, largest missing count, and oldest unresolved requirement.

### 8.4 NGO forms and reports

- Forms can be assigned to one NGO, a cohort, a country program, or every active NGO.
- Forms appear on the NGO card and in relevant work queues.
- Submission routes to a department based on the template’s module/mapping.
- Report exports are versioned and include reporting period, preparer, approval, calculations, source links, and delivery destination.

## 9. Finance Hub: fiscal-sponsor accounting MVP

### 9.1 Authority

- Finance managers—Super Admin, Admin, VP Finance, and approved Finance leadership—can create accounts and post, approve, void, reconcile, and close according to policy.
- Finance staff can read the ledger and prepare permitted drafts.
- NGO portal users cannot access the internal ledger.
- NGO finance users receive controlled NGO-scoped balances, transactions, requests, and reports.

### 9.2 Chart of accounts

The Create Account action is enabled when required code, name, type, and normal balance are valid. The server RPC:

- verifies finance-manager authority;
- trims and validates code/name;
- rejects duplicate codes;
- validates the parent account;
- writes account type/subtype, normal balance, active/cash flags, entity scope, restriction class, functional class, Form 990 line, and statement line;
- records an audit event;
- returns the created account;
- invalidates account, budget, transaction, journal, NGO-account, and dashboard queries so the new account is immediately selectable in downstream ledgers.

### 9.3 Core ledgers and controls

The Finance MVP acceptance scope includes:

- general ledger and journal workspace;
- accounts payable, bills, payments, and aged payables;
- accounts receivable, invoices, receipts, and aged receivables;
- bank/cash accounts, statement import, matching, reconciliation, and exceptions;
- expenses, receipts, reimbursements, and approvals;
- restricted funds, net assets, grants, programs, departments, NGOs, and functional expense dimensions;
- fixed assets and inventory under Finance;
- budgets, actuals, forecasts, variance, and cash-flow forecast;
- recurring entries, accruals, deferrals, reversals, opening balances, and period close;
- trial balance, profit and loss/statement of activities, balance sheet/statement of financial position, cash flow, functional expenses, fund/restriction reporting, and consolidation;
- Form 990 preparation data and year-end package controls;
- immutable posted-entry controls, balanced journals, void/reversal instead of destructive edits, period locks, approval separation, and audit evidence.

### 9.4 Fiscal-sponsor transaction flow

1. Receive money through an approved payment/bank provider.
2. Identify donor, campaign/grant, sponsored NGO, restriction, fee schedule, and source event.
3. Create a balanced receipt journal with cash, sponsored-organization liability/net asset treatment, revenue/restriction treatment, and fiscal-sponsor fee as configured.
4. Link payment/provider evidence and donor acknowledgement.
5. Reconcile to the imported bank settlement.
6. Process approved NGO disbursement through an automatic provider or Relay-controlled manual flow.
7. Store final provider/wire reference and receipt.
8. Post the disbursement journal and update NGO/fund reporting.

### 9.5 Relay

The repository supports a `relay_manual` connection method and requires final settlement reference/evidence before posting. A claim that HPG is “connected to the Relay account” requires production Relay credentials or an approved Relay/Make adapter, account mapping, webhook verification, sandbox test, and finance sign-off. Those secrets are not stored in source control.

### 9.6 QuickBooks-level definition

For HPG, “QuickBooks-level” means the acceptance scope above is complete, reconciled, permissioned, auditable, and usable for HPG/NGO operations. It does not include unrelated QuickBooks ecosystem functions, country payroll engines, tax filing services, marketplace add-ons, or certified accountant guarantees unless separately approved.

## 10. Development Hub

Development owns Partnerships, CRM, Procurement, Grants, Fundraising, and Revenue-development workflows.

### 10.1 CRM and partnerships

- organizations and contacts;
- relationship owner, stage, next action, interaction history, notes, consent, and segmentation;
- partner opportunities, agreements, due diligence, renewals, and deliverables;
- Gmail/Slack intake and work-item conversion;
- pipeline, conversion, activity, and portfolio reporting.

### 10.2 Grants

GrantStation-style HPG acceptance scope:

- opportunity discovery/import and de-duplication;
- funder eligibility, geography, thematic fit, deadlines, and scoring;
- proposal pipeline and collaborative tasks;
- documents, versions, approvals, budgets, contacts, and submission evidence;
- award terms, restrictions, installments, reporting schedule, milestones, and closeout;
- NGO allocation and fiscal-sponsor review;
- calendar entries for critical submissions;
- expected versus awarded versus received revenue;
- linkage to finance funds, restrictions, receivables, cash, and reporting.

### 10.3 Fundraising and events

Event/fundraising benchmark scope:

- campaigns, goals, segments, landing content, events, tickets/registrations where required;
- donor/attendee records, consent, acknowledgements, receipts, recurring gifts, pledges, and soft credits;
- payment/settlement link to Finance;
- allocation to NGO, campaign, grant, restriction, or program;
- refunds/chargebacks and reconciliation;
- event attendance, follow-up, conversion, and campaign dashboards;
- marketing automation and approved communication history.

### 10.4 Procurement

- vendor master and due diligence;
- request, quote comparison, approval, purchase order, receipt, invoice match, and payment handoff;
- conflicts, thresholds, documentation, and audit history;
- expense/account/dimension mapping into Finance.

## 11. Program Hub

Program owns NGO Coordination and NGO Onboarding plus delivery/outcome workflows.

- NGO application, due diligence, agreement, activation, coordinator assignment, and service plan;
- country/compliance profile and risk;
- program, cohort, milestone, activity, beneficiary-safe aggregate, output, and outcome records;
- scheduled NGO reports and missing evidence;
- coordinator portfolio workload and service-level deadlines;
- program budgets/actuals linked to Finance dimensions;
- grant deliverables linked to Development;
- approved impact stories/assets linked to Marketing;
- NGO-level and consolidated outcome dashboards.

## 12. Marketing and Communications

The Marketing/Communications MVP includes:

- brand/asset library and approval state;
- content calendar, campaigns, channels, audiences, owners, deadlines, and goals;
- website/social/email production work items;
- consent and suppression awareness;
- multilingual content variants;
- UTM/source attribution and inbound lead capture;
- NGO-specific campaign support;
- fundraising/grant/event promotion links;
- engagement, conversion, cost, and campaign dashboards;
- proof of publication and archived creative;
- department Slack/Gmail/Drive/Make inputs through the shared work-item contract.

## 13. HR Hub

HR is one canonical hub, not a disconnected duplicate module.

- staff/contractor/volunteer profile;
- job, department, manager, employment type/status, start/end dates;
- onboarding/offboarding checklists;
- staff documents, expiration, and access controls;
- timesheets, HR-recorded time, approval, and reporting;
- leave/PTO requests and balances;
- training, certifications, policies, acknowledgements, and reviews;
- compensation data with stricter access than general staff profiles;
- personal dashboard integration;
- birthday calendar entries only with an approved privacy policy and employee consent.

## 14. Compliance, governance, and government reporting

Compliance owns Governance. It includes:

- entity and jurisdiction obligations;
- board, committee, policy, conflict, decision, minutes, and attestation records;
- evidence requirements, reviews, remediation, and deadlines;
- tax/charity/registration/grant compliance calendars;
- Form 990 preparation sections, validation, approvals, package generation, and transmission evidence;
- NGO agreements and periodic certifications;
- access reviews, data retention, legal holds, and audit exports.

### 14.1 Digital government/entity delivery contract

Every destination is configured by jurisdiction and filing type. A delivery package must contain:

- reporting entity and identifier;
- reporting period and currency;
- schema/version;
- calculated values with source lineage;
- validation results and blocking errors;
- preparer and approver;
- attached evidence;
- checksum/package identifier;
- transmission mode (API, approved e-file provider, secure upload, email, or manual portal);
- submitted timestamp, external acknowledgement/reference, status, rejection reason, correction version, and final acceptance evidence.

No generic “send to government” button can bypass country-specific credentials, schema certification, legal approval, or human filing authority.

## 15. Technology and Audit

Audit is under Technology/IT for system-usage and control analysis, while financial/compliance auditors retain independent access lanes.

Monthly records exist for:

- Google Drive usage, sharing, storage, orphaned files, external access, and retention;
- Confluence activity, spaces, stale pages, permissions, and ownership;
- Slack activity, channels, guest access, retention, and inactive integrations;
- Trello boards, members, stale cards, public exposure, automation, and mapping coverage.

Each monthly report stores imported metrics, findings, recommendations, exceptions, source URL, analysis timestamp, reviewer, and status. IT’s dashboard must distinguish missing, pending, analyzed, reviewed, and exception states.

## 16. Calendar

The cross-department calendar supports:

- birthdays (subject to consent);
- monthly and important meetings;
- grant submissions;
- fundraisers and upcoming events;
- holidays;
- milestones;
- compliance deadlines;
- training;
- key departmental goals;
- work-item due dates.

Events support NGO, department, all-day status, importance, description, and annual recurrence for birthdays/holidays. Critical grant and compliance dates must be represented by an authoritative source record as well as the calendar projection.

## 17. Reporting and consolidation

### 17.1 Reporting levels

- individual staff workload;
- department operations;
- single NGO;
- NGO portfolio/cohort/country;
- HPG operating entity;
- fiscal-sponsorship activity;
- consolidated HPG plus sponsored activity where accounting policy permits;
- funder/grant/program/campaign/event;
- jurisdiction/government filing.

### 17.2 Report guarantees

- Every ledger-based report ties to the trial balance for the same entity, dimensions, period, posting state, and currency basis.
- Every summary can drill to source lines and evidence subject to permission.
- Draft, approved, filed, amended, and superseded versions are explicit.
- Reports show generation timestamp, period, filters, currency, accounting basis, and calculation version.
- Export supports human-readable PDF/Excel/CSV where required and machine-readable schemas where authorized.
- Inter-NGO and HPG/NGO comparisons use a common definition catalog so measures are not silently inconsistent.

## 18. Security, privacy, and reliability

### 18.1 Security controls

- PostgreSQL RLS for every tenant- or department-sensitive table.
- Service-role use only in server-side functions.
- Secrets only in managed server secret storage.
- Signed/verified inbound webhooks.
- least-privilege OAuth scopes and periodic connection review;
- malware/type/size controls for uploaded documents;
- private buckets unless a reviewed public use case exists;
- MFA/SSO policy for privileged users;
- access logging, role-change logging, and periodic access certification;
- environment separation for development, staging, and production.

### 18.2 Reliability controls

- atomic database workflows;
- stable external idempotency keys;
- queued delivery with retry/backoff and terminal failure;
- dead-letter/exception dashboard;
- correlation IDs from external event to work item to journal/report;
- backups and restore tests;
- schema migration rehearsal and rollback plan;
- health metrics for queue age, failure rate, duplicate rate, and unmapped routes.

### 18.3 Data residency and international operation

Before adding a country, HPG approves:

- lawful basis and privacy notice;
- required data location and transfer mechanism;
- retention and deletion schedule;
- currency, timezone, language, date/number format;
- charity/tax/reporting obligations;
- payment/disbursement provider availability;
- sanctions/KYC/AML responsibilities;
- local approver and escalation path.

## 19. AI assistant operating boundary

The AI assistant may:

- classify intake and propose department routing;
- summarize Gmail/Slack/Trello/Drive evidence;
- extract structured fields from documents;
- calculate draft report values from authorized data;
- detect missing evidence, outliers, duplicates, reconciliation candidates, or deadline risk;
- draft work items, donor communications, grant narratives, management commentary, and filing explanations;
- generate comparison and exception dashboards.

The AI assistant may not independently:

- change permissions or legal identity;
- post/void journals, release funds, sign agreements, submit government filings, or send external communications unless an explicit approved automation policy authorizes that exact action;
- invent missing transactions or evidence;
- treat a draft calculation as an accepted filing;
- expose one NGO’s data to another NGO or unauthorized department.

Every material AI recommendation stores sources, calculation inputs, confidence/exception state, reviewer, decision, and resulting record IDs.

## 20. Release gates

### Gate A — Code and schema

- production build succeeds;
- TypeScript succeeds;
- changed-file lint succeeds;
- migration applies to a clean staging database and an anonymized production clone;
- no recursive RLS policy or security-definer privilege escalation;
- generated Supabase types are refreshed after migration.

### Gate B — Workflow tests

- private draft tests pass for staff and NGO users;
- submit creates exactly one work item under retry/concurrency;
- each module routes to the expected org unit;
- department isolation tests pass;
- documents upload/read/delete tests pass for staff, NGO uploader, other NGO, and admin;
- admin create/delete tests pass;
- My Queue assignment tests pass.

### Gate C — Integration tests

- Trello create/update/complete/reopen/member add/member remove pass in sandbox;
- Gmail, Slack, Drive, and Make events are idempotent and route correctly;
- worker retry/dead-letter tests pass;
- secrets and OAuth scopes are reviewed;
- live gates remain off until sign-off.

### Gate D — Finance certification

- opening balances approved;
- subledgers tie to general ledger;
- bank reconciliation and exception handling pass;
- restricted fund, NGO, functional expense, and consolidation reports tie;
- new account is immediately usable across transaction/journal/report selectors;
- period close/reopen authority passes;
- Form 990/year-end package test ties to approved books;
- finance owner and independent reviewer sign the certification checklist.

### Gate E — NGO pilot

- pilot NGOs complete login, profile, upload, report, request, and dashboard tests;
- accessibility and selected-language review pass;
- support/runbook/escalation is staffed;
- no cross-NGO access is observed;
- pilot acceptance and remediation are recorded.

### Gate F — Production and 30-day stabilization

- migration, functions, secrets, routes, and scheduled workers are deployed;
- monitoring and alerting are active;
- first daily and monthly controls complete;
- queue failures and unmapped events are zero or accepted exceptions;
- HPG executive, Finance, Program, Development, Compliance, HR, IT, and NGO pilot owners sign final acceptance.

## 21. Definition of 100%

This MVP is at 100% only when:

1. every release-matrix row marked P0 or P1 has passing production evidence;
2. no item is counted complete solely because a page or database table exists;
3. every live integration has authenticated credentials, mapping, test evidence, owner, alert, and recovery procedure;
4. Finance reports tie to the approved ledger and opening balances;
5. NGO and department isolation has adversarial test evidence;
6. government delivery claims have destination-specific certification or are clearly labeled export/manual submission;
7. multilingual claims are limited to reviewed language packs actually delivered;
8. unresolved gaps are visible, owned, dated, and not represented as complete.

## 22. Implementation baseline in this branch

This implementation branch provides the foundation for the highest-risk gaps:

- private resumable form drafts;
- atomic submission and department-routed work-item creation;
- department memberships and department-scoped work-item RLS;
- multi-assignee My Queue;
- admin soft deletion;
- corrected document metadata and storage access model;
- NGO-upload-to-department work-item routing;
- profile/avatar/international preferences and staff dashboard;
- NGO Drive folder link;
- NGO missing-items prioritization;
- two-way Trello webhook foundation and member mapping;
- normalized Gmail/Slack/Drive/Make intake contract;
- Slack/email form notification queue integration;
- Finance permission alignment and canonical account-creation RPC;
- hub navigation ownership corrections;
- monthly IT connected-system usage audit records;
- expanded cross-department calendar taxonomy.

It does not, by itself, prove production deployment, live Trello/Relay/Gmail/Slack/Make credentials, opening-balance completeness, government e-file certification, or full human-reviewed translations. Those require the release gates above.
