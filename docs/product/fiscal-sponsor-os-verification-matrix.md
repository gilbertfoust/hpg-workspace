# HPG Fiscal Sponsor OS — MVP verification matrix

## Status legend

| Status | Meaning |
|---|---|
| Implemented in branch | Code/schema exists in this branch; staging migration and user acceptance are still required |
| Existing + reinforced | Capability already existed and this branch fixes or connects a critical seam |
| Configuration required | Code path exists, but credentials, mappings, templates, owners, or live switch are required |
| Certification required | Functional code is not sufficient; accounting, legal, security, or government acceptance is required |
| Planned after MVP | Valuable capability not represented as complete in this branch |

## Requirement-by-requirement acceptance

| ID | Requirement | Implementation/evidence | Production acceptance test | Current status |
|---|---|---|---|---|
| WF-01 | Form submit no longer returns RLS violation | Atomic security-definer submit RPC validates user/NGO/template and writes submission + work item | Staff and NGO user submit assigned form; HTTP/database success; exactly one work item | Implemented in branch |
| WF-02 | Submitted work item only responsible department can open | Canonical org-unit resolver and scoped work-item policies | Submit from non-department user; creator cannot open routed work item unless separately authorized; target department can | Implemented in branch |
| WF-03 | Save Draft visible only to author | Draft policies require author; private draft RPC | User A saves; no work item/events; User B/admin-without-bypass query behavior matches approved policy | Implemented in branch |
| WF-04 | Save Draft does not submit | Form runner uses separate draft RPC; work item is only created by Submit RPC | Count work items/notifications/Trello queue before and after 20 draft saves remains unchanged | Implemented in branch |
| WF-05 | Resume draft progress | `draft_progress`, Continue action, pre-populated runner | Save partial, sign out/in, resume exact values and progress | Implemented in branch |
| WF-06 | Submit exactly once | idempotency key and unique index; atomic transaction | Double-click, retry, and concurrent request produce one submission/work item/card queue row | Implemented in branch; concurrency test required |
| WI-01 | Separate work items by department | `department_id` resolves against `org_units`; UI filter plus RLS | Each department sees its queue and not unrelated department items | Implemented in branch |
| WI-02 | My Queue reflects owner and assignees | assignment table and queue RPC | Owner, assignee, reviewer see item; watcher behavior matches policy; unrelated user does not | Implemented in branch |
| WI-03 | Admin manually adds work item | Create dialog uses valid enum values and creator identity | Admin creates each priority/module/NGO combination and sees routed record | Existing + reinforced |
| WI-04 | Admin manually deletes work item | audited soft-delete RPC and admin-only drawer action | Admin deletes with reason; queues hide item; DB/audit retains it; non-admin denied | Implemented in branch |
| WI-05 | Invalid uppercase priority bug removed | create UI uses `low/medium/high` | Create low, medium, high without constraint error | Implemented in branch |
| TR-01 | Work item creates Trello card | queue trigger/manual action/worker route | Sandbox card appears once with title, description, route, labels/members | Configuration required |
| TR-02 | Trello card creates work item | authenticated inbound webhook with board/list mapping | Create sandbox card; one Workspace work item appears in mapped department | Implemented in branch; configuration required |
| TR-03 | Trello done completes work item | closed card or `completed_list_id` maps to complete | Move card to Done; work item completes and leaves active queues | Implemented in branch; configuration required |
| TR-04 | Trello reopen reopens work item | inbound card state maps complete to in-progress | Reopen card; Workspace updates without echo loop | Implemented in branch; configuration required |
| TR-05 | Trello member updates My Queue | member mapping + work-item assignment upsert/delete | Add/remove mapped member; My Queue updates within webhook SLA | Implemented in branch; configuration required |
| TR-06 | Trello events do not duplicate/loop | integration event uniqueness and external-sync timestamp | Replay same action and observe no duplicate; monitor outbound queue after inbound action | Implemented in branch |
| GM-01 | Gmail message creates department work item | `gmail.work_item` Make intake with source identifier and module normalization | Send labeled test email; one item routes to configured department; replay is idempotent | Configuration required |
| SL-01 | Work items connect to Slack departments | notification routes and durable form/upload event queues | Submit form for every module; correct channel receives one notification with work-item link | Existing + reinforced; secrets required |
| SL-02 | Slack can create work item | `slack.work_item` Make intake | Send approved Slack command/event; one routed item with source ID | Configuration required |
| MK-01 | Make.com functions connect | authenticated automation receiver and event normalization | Test each supported event, invalid secret, duplicate, invalid status, and retry | Existing + reinforced; scenario configuration required |
| GD-01 | Google Drive link on NGO card | NGO edit/overview supports master folder URL | Save valid Drive URL, reopen card, follow link | Implemented in branch |
| GD-02 | Completed work exports to department Drive | existing controlled export retained | Complete/approve item and export to mapped folder with archived URL | Existing; Drive mapping/credentials required |
| PF-01 | User profile | profile page and update hook | User updates permitted fields and cannot change role/department | Implemented in branch |
| PF-02 | Profile photo like Slack | avatar upload to profile bucket and clickable identity | Upload JPG/PNG under 5 MB; sidebar/avatar updates; other user cannot overwrite | Implemented in branch |
| PF-03 | Profile includes name, photo, department | identity card resolves org unit | Verify staff and admin profiles | Implemented in branch |
| PF-04 | Staff dashboard | dashboard RPC and My Workspace page | Validate queue/deadline/progress/time/document metrics against source rows | Implemented in branch |
| PF-05 | Several language choices | seven stored preferences | Select each language and persist | Implemented in branch |
| PF-06 | Actual translated interface | language packs and RTL not completed by selector | Native-speaker and accessibility review for each claimed language | Planned after MVP |
| NGO-01 | NGO account and login | existing portal roles/access model | Pilot NGO logs in and cannot access internal app/other NGO | Existing; security certification required |
| NGO-02 | NGO dashboard/tools/reporting | existing portal plus form/document/finance modules | Pilot completes defined end-to-end scripts | Existing; UAT required |
| NGO-03 | NGO uploads to coordinator/department | storage access helper + document trigger creates routed work item | NGO uploads general file; coordinator sees linked item; other NGO cannot read | Implemented in branch |
| NGO-04 | NGO report exports to departments | form module mapping and atomic route | Submit Finance/Program/Development reports and validate destination | Existing + reinforced; templates required |
| NGO-05 | Forms appear on NGO card/work items | template/submission linkage retained | Assign form, submit, verify NGO card and department work item | Existing + reinforced |
| NGO-06 | Missing-item checkbox by NGO | received checkbox approves evidence | Toggle received; counts and status update | Implemented in branch |
| NGO-07 | Missing items split by process, priority, count | per-NGO summary and columns | Validate Development/Coordinator groups and sort logic | Implemented in branch |
| DOC-01 | Upload no longer violates RLS | storage uses canonical NGO access; metadata policies aligned | Staff, authorized NGO, unauthorized NGO, and admin matrix | Implemented in branch |
| DOC-02 | Documents upload | existing upload hook + repaired policies | PDF/image/Office allowed types, size, metadata, download | Existing + reinforced |
| DOC-03 | Delete works | uploader/admin delete policy; DB-first cleanup | Uploader and admin delete; unauthorized denied; storage failure logged | Implemented in branch |
| NAV-01 | HR and Finance hubs merged with modules | one canonical HR/Finance navigation | Role-by-role navigation audit | Implemented in branch |
| NAV-02 | NGO Coordination under Program | Program Hub navigation | Navigation and route access test | Implemented in branch |
| NAV-03 | Partnerships/CRM/Procurement/Grants under Development | Development Hub navigation | Navigation and ownership test | Implemented in branch |
| NAV-04 | Assets/Inventory under Finance | Finance Hub navigation | Navigation and authority test | Implemented in branch |
| NAV-05 | Governance under Compliance | Compliance Hub navigation | Navigation and authority test | Implemented in branch |
| NAV-06 | Audit under IT | Technology Hub and monthly system audit | Navigation and IT RLS test | Implemented in branch |
| AUD-01 | Monthly Drive/Confluence/Slack/Trello analysis | monthly audit table and IT dashboard cards | Import source reports, analyze, review, and flag exception for each provider | Implemented in branch; import adapters required |
| CAL-01 | Calendar categories | expanded event types and metadata | Create birthday, meeting, grant, fundraiser, event, holiday, milestone, goal | Implemented in branch |
| CAL-02 | Work deadlines on calendar | existing work-item projection retained | Work-item due date appears and filters by access | Existing |
| FIN-01 | Finance permission error corrected | Finance helpers align profile and role table including VP Finance | Super Admin/Admin/VP Finance/Finance manager matrix; NGO denied | Implemented in branch; staging RLS test required |
| FIN-02 | COA Create button can save | canonical server RPC called by create hook | Enter valid required fields, save, receive returned account | Implemented in branch |
| FIN-03 | Created account available to other ledgers | broad finance query invalidation | Create account then open journal/transaction/budget selectors without reload | Implemented in branch |
| FIN-04 | Journals/accounts generated from source information | existing atomic finance workflows retained | Test receipt, expense, invoice, bill, disbursement, opening balance, reversal | Existing; finance certification required |
| FIN-05 | All transactions entered and archived | provider/backfill/reconciliation procedure | Source-system completeness reconciliation for defined cutover period | Certification required |
| FIN-06 | Ledgers total to reports/dashboards | double-entry reports and tie-out gates | GL = trial balance; subledgers and statements reconcile for each scope | Existing; finance certification required |
| FIN-07 | Important ledgers in Finance Hub | accounting suite/navigation retained | Finance feature inventory and role test | Existing; UAT required |
| FIN-08 | Relay account connection | `relay_manual` evidence-controlled path exists | Live/sandbox connection, account mapping, webhook, disbursement and reconciliation | Configuration/certification required |
| FIN-09 | QuickBooks-level HPG scope | blueprint Section 9 defines bounded parity | Finance owner signs end-to-end checklist for agreed HPG scope | Certification required |
| DEV-01 | Development/CRM/partnership/procurement/grants | modules exist and are grouped | Department scripts and reporting tie-outs | Existing; gap UAT required |
| DEV-02 | GrantStation-style grant tracking | grant pipeline, documents, applications, reporting foundations exist | Opportunity-to-closeout pilot | Existing; benchmark UAT required |
| DEV-03 | Event/fundraising benchmark | campaign/revenue/event scope in blueprint | Campaign-to-payment-to-ledger pilot | Planned/partial; not certified complete |
| MKT-01 | Marketing operating depth | marketing module and shared work/integration foundation | Campaign lifecycle and reporting pilot | Existing/partial; UAT required |
| PROG-01 | Program operating depth | Program + NGO Coordination grouping and existing modules | NGO onboarding/report/outcome pilot | Existing/partial; UAT required |
| HR-01 | HR operating depth | existing HR data plus staff dashboard | Hire-to-offboard/timesheet/document pilot | Existing/partial; privacy UAT required |
| CMP-01 | Compliance/governance depth | existing compliance/governance/year-end foundations | obligation-to-filing evidence pilot | Existing/partial; legal UAT required |
| GOV-01 | Digital reporting to governments/entities | package/transmission contract defined; Form 990 foundation exists | Destination-specific schema, credential, acknowledgement and rejection tests | Certification/configuration required |
| RPT-01 | Different reporting among HPG/NGOs | entity/dimension/report architecture exists | NGO, portfolio, HPG, sponsorship and consolidation tie-outs | Existing; certification required |
| AI-01 | AI calculation/assistant environment | controlled assistant boundary defined | Source lineage, calculation repeatability, approval, permission and audit tests | Policy/implementation required by workflow |

## Deployment evidence checklist

The release owner attaches the following to the production change record:

- migration apply output and schema version;
- generated Supabase type diff;
- production build artifact/hash;
- changed-file lint and TypeScript output;
- RLS persona test output;
- form draft/submit concurrency test output;
- document upload/delete test output;
- Trello sandbox event IDs and corresponding Workspace IDs;
- Gmail/Slack/Make/Drive test event IDs;
- finance tie-out workbook/report IDs and reviewer sign-off;
- NGO pilot sign-off;
- government connector certification where applicable;
- rollback/recovery test;
- 30-day monitoring dashboard link.

## Honest current-state statement

This branch materially corrects the listed workflow and permission gaps and provides the production MVP foundation. It is **not yet accurate** to call the running Workspace 100% complete until this migration and its Edge Functions are deployed, integration secrets/routes are configured, production data is migrated/reconciled, and the acceptance tests above pass. Broad vendor-level claims remain bounded by the HPG-specific scope in the blueprint.
