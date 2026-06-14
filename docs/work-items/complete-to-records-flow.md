# Work Item Complete to Records Flow

This enhancement keeps the completed-work-item workflow from PR #68 and adds a faster table-level action.

## Active work item behavior

When staff complete a work item:

1. the work item is marked `complete`
2. `completed_at` is set
3. `archived_at` is set so the item leaves active work-item queues
4. an Admin Records row is created or updated in `work_item_admin_records`
5. a snapshot of the work item is stored in `snapshot_json`

The work item is not permanently removed from the database. It is archived and retained for audit/history.

## UI behavior

The Work Items table now supports:

- a Done checkbox column
- a row menu action to send the item to Admin Records
- refresh of active work item lists after completion

## RPC used

The UI uses the merged PR #68 RPC:

```sql
public.complete_work_item_for_admin_records(_work_item_id uuid, _notes text default null)
```

This intentionally avoids the older conflicted RPC name from PR #70.
