# Dashboard Phase 8: Filter Sync + Section Anchors

This phase makes dashboard filters and section drilldowns shareable and consistent without rewriting the dashboard.

## Purpose

Before this phase:

- Dashboard filters lived only in local React state.
- Drilldown links could include query params, but reloading or sharing the URL did not restore the dashboard view.
- Links like `/dashboard?section=data-health` did not scroll to the target section.

After this phase:

- Filters and section anchors sync to the URL.
- Today's Action Center and Recent Activity respect dashboard filters where practical.
- Module Snapshots and Data Health remain system-wide views.

## URL parameters

| Param | Purpose |
|-------|---------|
| `bundle` | Filter NGOs and related work by bundle |
| `country` | Filter NGOs and related work by country |
| `state` | Filter NGOs and related work by state/province |
| `module` | Filter work items by module |
| `section` | Scroll to a dashboard section after load |

Example:

```text
/dashboard?bundle=East%20Africa&module=finance&section=action-center
```

## Section anchors

Stable section IDs on the main dashboard:

- `filters`
- `drilldowns`
- `executive-brief`
- `kpis`
- `action-center`
- `module-snapshots`
- `recent-activity`
- `data-health`
- `charts`
- `workload`
- `risk-evidence`

Use `section=<id>` in the URL to scroll to that block. The Data Health drilldown already links to `section=data-health`.

## Filter behavior by section

| Section | Respects dashboard filters |
|---------|---------------------------|
| Executive Brief | Yes |
| KPI cards | Yes |
| Today's Action Center | Yes (module + NGO portfolio filters) |
| Module Snapshots | No — system-wide snapshot |
| Recent Activity | Partial — work items, documents, NGOs; grants/forms/audit hidden when filters active |
| Data Health | No — system-wide schema readiness |
| Charts / workload / at-risk | Yes |

## Implementation notes

- `useDashboardUrlState` reads and writes filter + section query params with `replace: true` (no full page reload).
- `useDashboardSectionScroll` scrolls to a validated section ID after render.
- `fetchNgoFilterIds` in `useDashboardData.ts` is shared by Action Center and Recent Activity for consistent NGO portfolio filtering.
- Action Center urgency scoring is unchanged; only the work item query scope changes when filters are active.

## Why this matters

Staff can bookmark or share a filtered dashboard view. Drilldowns that stay on the dashboard (like Data Health) land on the right section. Action Center and Recent Activity align with the rest of the filtered dashboard instead of always showing workspace-wide data.
