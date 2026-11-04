# HPG Workspace Learning Academy — first implementation and function audit

**Status:** Development branch; requires CI and production role-based acceptance tests.
**Scope:** Internal staff, development/grant writers, communications, marketing, research, finance, accounting, and board orientation.

## Built in this change

| Component | Functional change | Acceptance test |
|---|---|---|
| Learning Academy | Protected /learning route, eight role-based paths, step-by-step tasks, navigation links, marked-unavailable lessons | Sign in as staff and board; verify only allowed links activate, navigation works, and unfinished actions do not claim readiness |
| Help navigation | Persistent sidebar entry and header Help button | Navigate from dashboard and a departmental screen |
| Communications Studio | Replaces placeholder; create and view article, issue, interview, press-release, newsletter and research-brief work assignments through existing work_items hooks; update status | Authorized communications user creates a real authorized task, sees it in Work Items, and updates status under RLS |
| Marketing Studio | Replaces placeholder; create and view social-media and campaign assignments through existing work_items hooks | Authorized marketing user creates an approved campaign task and sees it in Work Items |
| Local progress | Stores self-reported Academy completion under logged-in user ID in localStorage | Reload on same browser; progression persists; no cross-device or HR-reporting claim |

## Source-grounded gaps and next implementation gates

1. **Board Hub:** Current GovernanceDashboard is about FX, jurisdiction compliance and account mapping, not board meeting packs, committee assignments, minutes, or voting. Do not train voting until a board-specific permissions, immutable decision log, and testable workflow exist.
2. **Magazine publishing:** Communications Studio now tracks work, but editorial layout, issue assembly, preview, approval chain, versioned publication, and issue archive still need implementation.
3. **Interviews:** Work assignment tracking exists; consent records, interview scheduling, recordings/transcripts, restricted storage, and publication rights require a separate approved process.
4. **Social-media publishing:** Marketing Studio tracks campaigns and drafts. Account connections, post approval, scheduling, publishing, and platform analytics do not follow from a task record.
5. **Research:** Work Items and Documents can organize research. A dedicated citation, source-quality, research-review, and evidence linkage workflow is not yet implemented.
6. **Grant writers:** Grant Search, Grant Pipeline, Development, and Proposal Collaboration routes exist. Run actual role-based tests for opportunity creation, NGO association, assignments, deadlines, proposal drafts, attachments, and stage updates before declaring an end-to-end training course certified.
7. **Budgets and accounting:** Finance Budget, Receipts, Reconciliation, and Reporting routes exist. Test authorized input, nonposting previews, period controls, audit history, approvals, and reconciliation with realistic nonproduction fixtures; do not create synthetic transactions in production.
8. **Permissions:** Route guards use accessControl.ts and database RLS. Verify least privilege for board/viewer, department lead, staff, and NGO accounts. In particular, training progress must not grant or elevate role access.

## Lesson policy

- **Guided navigation** means the destination route and workflow entry point exist in the source; it does not certify a successful end-to-end production operation.
- **Function not ready** means the lesson is visibly disabled until its actual workflow is delivered and tested.
- **Completion** currently means self-report on the current device; it is not a centrally verified training record.
- The Learning Academy does not use live practice records, conduct real votes, post public content, or authorize spending.

## Recommended next delivery sequence

1. Run CI build, TypeScript and lint; conduct authorized role-based staging acceptance tests.
2. Finish communications editorial approval, consent and magazine publishing; connect publication workflow to existing tasks and documents.
3. Finish marketing channel integrations and campaign reporting with review gates.
4. Implement a protected board-only hub using actual board roles and recorded governance events.
5. Add controlled Academy progress records and staff/board learning dashboards in the correct live backend after RLS review.
6. Extend research evidence library and finance/grant guided screen-level tours; certify each against functionality, not screenshots.

A feature should be marked ready for training only when access, create/read/update operations, auditability where needed, and an error/retry path have all passed testing.
