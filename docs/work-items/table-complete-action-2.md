# Clean Table Action Rebuild

PR #68 already merged the work item completion workflow.

This branch adds the faster table action:

- Done checkbox in Work Items table
- row menu completion action
- uses the merged admin-record RPC
- refreshes the active list after completion

Completed items are archived, not permanently removed.
