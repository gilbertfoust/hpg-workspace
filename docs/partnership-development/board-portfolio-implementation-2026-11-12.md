# Partnership Development: Board-linked operating portal

**Prepared 12 November 2026.** The operating function remains **Partnership Development** in HPG's Development Department. It is not automatically renamed Strategic Partnerships & Resource Development. Any individual operational designation remains separate from Board membership and requires formal approval.

## Current implementation
- `/board/partnership-development`: Board-linked, permission-gated operational dashboard.
- Prospect intake writes to the existing `development_outreach_prospects` register and a linked case. Existing prospects can be imported without re-entering their details.
- Partner cases carry a stage, contact information, related program, next action, due date and case history.
- Activities can be recorded as outreach, meetings, follow-ups, proposals, outcomes or notes.
- Structured proposals record intended outcomes, responsibilities, resources, forecast costs and compliance questions.
- Submission opens a controlled Development review request, **not** a vote, contract, or payment.
- `/development/partnership-reviews`: authorized Development team triages submitted proposals into existing work items. Finance, Compliance, Programs, General Counsel, Executive and Board reviews then occur through established procedures.
- Portal includes verified Confluence sources for Partnership Development SOPs, reports and HPG Executive Professional Academy.

## Permission policy
No user is automatically granted this new operating portfolio. For a Board member to use it:
1. Verify the user's authenticated Workspace ID and active Board membership.
2. Complete Board/bylaw approval of any operational delegation and document the authorization reference.
3. As an authorized administrator, insert or update `public.partnership_portal_assignments` for that user, including `board_authorization_reference`, `authorized_by`, `authorized_at`, and `is_active=true`.
4. Verify the user can reach the portal while unrelated Board and NGO users cannot.
5. Verify the target user can read the selected Confluence pages; portal navigation does **not** override Confluence permissions.

The Board role does not receive general access to Development, finance, CRM, donor or sensitive records. Case data is limited by user ownership; Review Queue access requires active internal Development authorization. Front-end route protection is supplementary to database checks.

## Current boundary
- HPG Board authority for binding partnership agreements and formal votes remains in the existing Board Hub.
- Work-item triage does not generate a Board vote automatically. The governed agenda process must link the approved proposal case to a Board packet before any contract authorization.
- Academy instruction and training ownership remain program responsibilities. Juanita's contemplated management of staff, NGO and stakeholder training sections is a planned designation pending appropriate approvals.
- No direct George Brooks account or active Board membership was found in the connected Workspace at implementation time. No assignment was made.
- No email or meeting invitation is sent by this software change.

## Verification
A transaction-rolled-back access test established that an active Board member with a temporary controlled assignment could access the portal; no assignment returned false. A transaction-rolled-back workflow test successfully created a prospect, recorded an activity, submitted a review request, and let an active Development department lead route it to a work item without granting Board-level write privileges. Temporary test records were rolled back.

## Remaining release checks
1. Frontend build/typecheck/lint in CI and visual review of the new route.
2. Resolve George's correct HPG Workspace identity and Confluence permissions.
3. Confirm his actual operational charter, accountable supervisor, and written Board authority.
4. End-to-end browser tests, including denied access for unrelated Board members and external NGOs.
5. Confirm Development assignment, legal/finance routing, Board motion packet, and archive retention before any real partnership execution.
