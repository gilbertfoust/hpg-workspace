# Dashboard Command Center Buildout (Phases 8–20)

Local buildout branch: `dashboard-local-buildout`

This document summarizes the command center dashboard work completed in phases 8–20 on the main `/dashboard` route.

## Architecture overview

The dashboard is a single-page command center orchestrated by `src/pages/Dashboard.tsx`. It composes:

- **Inline sections** — filters, drilldowns, KPIs, charts, at-risk/evidence panels
- **Extracted components** — `src/components/dashboard/*`
- **Data hooks** — TanStack Query hooks querying Supabase directly (`src/hooks/useDashboard*.ts`)
- **URL state** — `useDashboardUrlState` syncs filters and section anchors to query params
- **Local persistence** — saved views in `localStorage` via `useSavedDashboardViews`

No dedicated dashboard API layer or global state store. `MainLayout` provides the shell and command-center background.

## Phase summary

| Phase | Commit message | What shipped |
|-------|----------------|--------------|
| 8 | Add dashboard filter sync and section anchors | URL-aware filters, section scroll anchors, filter-aware Action Center + Recent Activity |
| 9 | Add saved dashboard views | localStorage saved views near Dashboard Filters |
| 10 | Add dashboard board brief mode | Leadership print view toggle + `window.print()` |
| 11 | Add dashboard alerts banner | Urgent issues strip with drilldown buttons |
| 12 | Add dashboard follow-up queue | Compact next follow-ups panel |
| 13 | Add NGO portfolio intelligence panel | Country/bundle/status distribution + insights |
| 14 | Add grant pipeline intelligence panel | Grant opportunities/applications summary |
| 15 | Add finance readiness panel | Finance table health + recommended next action |
| 16 | Add HR readiness panel | HR table health + recommended next action |
| 17 | Add dashboard data definitions | Expandable metric/panel definitions |
| 18 | Improve dashboard empty states | Shared `DashboardPanelState` for loading/error/empty |
| 19 | Polish dashboard mobile layout | Responsive grids, scroll margins, overflow fixes |
| 20 | Harden dashboard command center buildout | Deduped search param helper, docs, cleanup |

## Section layout (normal mode)

1. Header + Board Brief toggle
2. Alerts banner (when urgent)
3. Filters + saved views
4. Drilldowns
5. Executive Brief
6. KPIs
7. Today's Action Center
8. Follow-Up Queue
9. Module Snapshots (system-wide)
10. Recent Activity
11. Data Health
12. Finance + HR Readiness
13. Quick Nav
14. Charts (trend, status, portfolio)
15. NGO Portfolio Intelligence
16. Grant Pipeline Intelligence
17. Department Workload
18. At-Risk + Missing Evidence
19. Data Definitions

## Filter behavior

**Filter-aware:** Executive Brief, KPIs, charts, workload, at-risk/evidence, Action Center, Follow-Up Queue, Recent Activity (partial), Portfolio Intelligence, Alerts banner.

**System-wide:** Module Snapshots, Data Health, Finance/HR Readiness, Grant Pipeline.

## Key files

```
src/pages/Dashboard.tsx
src/hooks/useDashboardUrlState.ts
src/hooks/useSavedDashboardViews.ts
src/hooks/useDashboardData.ts
src/hooks/useDashboardActionCenter.ts
src/hooks/useDashboardRecentActivity.ts
src/hooks/useDashboardDataHealth.ts
src/hooks/useDashboardPortfolioIntelligence.ts
src/hooks/useDashboardGrantPipeline.ts
src/lib/dashboardSearchParams.ts
src/components/dashboard/
docs/dashboard/
```

## Board Brief Mode

When enabled, hides operational panels and shows Executive Brief, KPIs, NGO portfolio chart, data health summary, and workload chart. Print uses browser print with sidebar/header hidden via `@media print` CSS.

## Saved views

Stored in `localStorage` key `hpg-dashboard-saved-views`. Each view saves bundle, country, state, module, and optional section anchor.

## Data health definitions

- **Live** — table connected with records
- **Empty** — table exists, no records yet
- **Missing** — dashboard could not access the source

## Next steps (not in scope)

- Supabase-backed saved views (multi-device sync)
- Server-side dashboard aggregation API
- Deep grant/finance analytics beyond current table counts
