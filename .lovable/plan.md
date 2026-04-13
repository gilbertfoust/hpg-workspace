

# Plan: Add Form Analytics Tab

## Summary

Add an "Analytics" view mode to the Forms page showing submission counts per template, completion rates (accepted/total), and average time to complete — all computed client-side from existing `form_submissions` data.

## Technical Details

### New hook: `src/hooks/useFormAnalytics.ts`

A custom hook that queries `form_submissions` joined with `form_templates` and computes per-template:
- **Total submissions** count
- **Completion rate** = accepted / (submitted + accepted + rejected) as percentage
- **Avg time to submit** = average of `submitted_at - created_at` in hours
- **Status breakdown** (draft, submitted, accepted, rejected counts)

Uses the existing `form_submissions` table with `form_template_id` FK join to `form_templates`.

### New component: `src/components/forms/FormAnalyticsTab.tsx`

Renders three sections:
1. **Summary KPI cards** — Total submissions, avg completion rate, avg time to complete, most active template
2. **Per-template table** — Template name, module badge, submission count, completion rate bar, avg hours
3. **Module breakdown chart** — Recharts PieChart showing submissions by module (reuses existing recharts dependency)

### Update: `src/pages/Forms.tsx`

- Add a third view mode button "Analytics" (BarChart3 icon) alongside Templates and Submissions
- Render `<FormAnalyticsTab />` when `viewMode === "analytics"`

### No database changes needed

All analytics are computed client-side from the existing `form_submissions` and `form_templates` tables. No migrations required.

