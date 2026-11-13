# Partnership Development Working-Board Portal — pre-activation QA and release gates

**Scope:** HPG Workspace project `mlmjlgmsrkemsuwdohsa`, Board route `/board/partnership-development`, Development triage route `/development/partnership-reviews`. Prepared 2026-11-13 UTC.

**Release intent:** Deploy capability behind existing auth, active account, active Board membership and a separately approved portfolio-assignment gate. Do **not** activate George Brooks, send an email, issue a Board approval, grant Confluence access or create live partner commitments as part of this QA.

## Results verified by live, rollback-only Supabase tests

| Risk / prior HPG incident class | Test or implementation response | Status |
| --- | --- | --- |
| Unapproved or misidentified Board accounts | `can_access_partnership_portal` requires active account, Board membership, explicit assigned authorization; no active assignments | Database control verified; browser login not yet certified |
| Duplicate NGO/prospect/card creation | Board case has owner+normalized-name uniqueness; canonical Development prospect is reused; duplicate request returns existing case | Passed rollback test |
| Cross-account / unrelated prospect exposure | Board overview displays only Development prospects individually shared with that portfolio; unshared import rejected | Passed rollback test |
| Development research handoff | Development can share one selected lead, Board can import it once | Passed rollback test |
| Forms failing to persist / lost draft | Draft-save RPC updates case before submission; board UI provides Save Draft | Passed rollback test; refresh/browser persistence must be tested after deployment |
| Incorrect record selected / stale form inputs | Case-change effect resets activity, proposal, document and support forms; React Query keys include user ID | Build verified by CI; browser workflow pending |
| Broken work-item status/priority | Development support creates work items using canonical `Med` priority; proposal review uses canonical `High` | Previous failure reproduced and fixed; passed rollback test |
| Research, writing and budget requests lost | Support requests are queued for Development staff to accept into existing work items, with request status shown in Board case | Passed rollback test |
| Board self-approval / legal-finance bypass | Board can submit but cannot create privileged Development work items, set approval stage, sign, or vote from portfolio | Verified with database gates |
| Review changes and ongoing partner stewardship | Development can request corrections; Board can resubmit; activity logging remains enabled during review | Passed rollback test |
| Competing Partnership Pipelines | When Development accepts a proposal, link to canonical `partners` and `partnership_pipeline`; no second independent operational pipeline | Passed rollback test |
| Missing or inaccessible documents | Portal saves HTTPS links to existing Drive/Confluence documents; no new bucket, attachment or PDF copy; original file permissions are respected | URL/duplicate checks passed; actual recipient downloads require login test |
| Blocked embeds / navigation redirects | Portal uses normal external links and real internal routes rather than embedded Confluence videos; links require independent Confluence permissions | Source/route review complete; live browser click test pending |
| Date/time confusion | Follow-up uses `datetime-local` and stores an ISO UTC timestamp; screen labels local timezone | Code review completed; test New York and Central timezone in browsers |
| Stale status / unclosed records | Board cases track stage/status separately from formal reviewed work items; closing a lead clears next action/due date | SQL logic updated; browser walkthrough pending |
| Direct RLS/data API access | Portfolio tables use RLS and only authenticated, permission-gated server routines write to canonical tables | Verified grants/policies; advisor reviewed |
| Mobile errors / iOS browser | Forms use responsive cards/tabs, not full-screen embeds | Requires actual iPhone/iPad Safari smoke test |
| Notification failures / mistaken sender | No outbound email or Slack message is emitted by portal submit; Development must use its own review queue | Deliberately not claimed to be a proven notification system |
| Legacy schema differences / migration replay | Migration files accommodate historical live-only tables and canonical `org_units` department | Full migration CI must pass before merge |
| App bundle lacking Supabase configuration | Current repo CI confirms build; production environment URL/keys and fresh browser session still require deployment validation | Not verified live |
| Account deactivation/revocation | Role and active assignment gate is checked inside each mutation; Board account cannot update its assignment | Verified security behavior; revocation user-session/browser check pending |
| Unauthorized Confluence pages | Reference navigation preserves Confluence permissions and never exposes content through a server definer | Individual access test pending |
| 100 MB file uploads and PDFs | The Board module deliberately **links** existing controlled documents rather than providing a new uploader | Existing Drive/Confluence upload/permission flows are reused, not re-tested here |
| Google Calendar / Zoom | Board can record meeting and follow-up notes. No new calendar or Zoom event is automatically generated | No sync claim; coordinate with existing calendar service separately |

## Navigation and reuse, not duplication

- Board landing: `/board/partnership-development`
- Confluence governing index: https://humanitypathways.atlassian.net/wiki/spaces/BODS/pages/607125514/Partnership+Development+Working-Board+Operating+Hub+Proposed
- Partnership procedures: https://humanitypathways.atlassian.net/wiki/spaces/DDS/pages/35127314/Partnership+Development+SOPs
- Partnership reporting forms: https://humanitypathways.atlassian.net/wiki/spaces/DDS/pages/289112069/Partnership+Development+Reporting+Templates+HPG
- Partnership/Grant forms collection 1: https://humanitypathways.atlassian.net/wiki/spaces/DDS/pages/605028365/Grant+and+partnership+development+forms+1
- Partnership/Grant forms collection 2: https://humanitypathways.atlassian.net/wiki/spaces/DDS/pages/605290497/Grant+and+partnership+development+forms+2
- Existing Development proposal triage: `/development/partnership-reviews`
- Existing Development Partnership Pipeline: `/partnerships` (Development-authorized access only)
- Existing Board votes/agenda: `/board/hub`
- Existing Work Items: `/work-items`
- Academy source materials remain in their existing Confluence space.

## Release/activation sequence

1. Confirm current PR checks for **CI, Learning Academy validation and Supabase Migration Validation** are green; no merge/deploy on failed checks.
2. Merge and deploy behind the role gate, then open the production route with a **dedicated approved test account**. Avoid testing with a real NGO, George's account or live partner.
3. Verify denied external NGO, viewer/non-assigned Board, expired Board membership, unapproved/deactivated account, invalid authentication, and cross-case RPC access; no protected content should render in browser or network responses.
4. Verify assigned Board case: select assigned Development prospect, create one new test prospect, reject duplicate, save/reload proposal draft, log meeting and follow-up, link permitted document, reject unsafe URL, send support request, submit proposal, receive correction and resubmit.
5. As an authorized Development staff test user, verify partner handoff, queue, work item, canonical Pipeline link, no unauthorized Board direct access, and record continuity on refresh.
6. Check real Confluence/Drive links through the test user's permissions; confirm shared PDFs download from their original repository, deny links without permission, avoid blocked embed.
7. Test desktop and mobile/iPad Safari; offline/slow-network error handling, refresh, back navigation and repeated clicks.
8. Confirm local-time conversion, task closure and reports; do **not** claim Google Calendar sync until separately proven.
9. Confirm logs lack new 401/403/404/5xx failures related to these routes, then record an activation signoff. Only after governance approval and verified account should George's assignment be enabled.

**No activation or email is authorized by this document.** Browser-level verification cannot be inferred from database tests or GitHub Actions alone.