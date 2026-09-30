# Own staff activity and dashboard repair

Production returned permission denied for `staff_profiles` from the invoker
`hr_get_workspace_activity_summary` RPC. `get_my_staff_dashboard` had the same direct
staff-table reads. Direct personnel-table SELECT is deliberately unavailable.

The targeted migration replaces those reads with a private, fixed-search-path helper
that returns only the authenticated active caller's own staff context. It accepts no
user ID argument. Anonymous execution remains revoked. Both public RPCs remain invoker
functions; no personnel-table grant or RLS policy was changed.

Applied to production on September 30, 2026, after comparing current function definitions
with the captured baseline to reject a stale replacement.

Validation passed before deployment under rollback and again after deployment:
- Authenticated admin with AAL2 can load the activity summary and personal dashboard.
- The helper returns no other user's staff row.
- AAL1 privileged identity and unknown identity are denied.
- Anonymous execution and direct staff-table SELECT remain denied.

The separate NGO portal render incident is still under investigation. This database
repair does not establish that the portal render failure is resolved.
