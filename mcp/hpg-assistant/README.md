# HPG Assistant MCP Integration Scaffold

This folder documents the future private ChatGPT connector path for the existing HPG Workspace.

## Purpose

The first HPG Assistant layer should remain grounded in the existing HPG Workspace database and workflows. The assistant should not become a separate system of record.

The first private MCP tool should expose the same logic currently implemented in:

- `src/lib/hpgAssistant.ts`
- `src/pages/HPGAssistant.tsx`

## First MCP Tool

### `generate_onboarding_packet`

**Purpose:** Generate a post-contract NGO Coordination onboarding packet from one NGO record and its existing work items.

### Inputs

```json
{
  "ngo_id": "uuid"
}
```

### Output

```json
{
  "ngoId": "uuid",
  "displayName": "Megabridge Foundation",
  "handoffReady": true,
  "documentsMissing": [],
  "departmentChecklist": [],
  "riskFlags": [],
  "introEmail": {
    "subject": "Introduction to HPG NGO Coordination",
    "body": "..."
  },
  "cabinetSummary": "..."
}
```

## Safety Model

Version 1 should be read-only and draft-only.

The MCP server should not:

- send emails,
- approve NGOs,
- modify financial records,
- publish donor-facing claims,
- mark an NGO fully onboarded,
- change contracts or sponsorship models.

Write tools should be introduced only after explicit approval workflows exist in Supabase.

## Recommended Server Stack

- Node.js / TypeScript
- Supabase service role key on the server only
- Tool-level permission checks
- Audit logging for every tool call
- Hosted endpoint for ChatGPT Developer Mode testing

## Future Tools

1. `search_ngos`
2. `get_ngo_profile`
3. `generate_onboarding_packet`
4. `list_missing_documents`
5. `draft_ngo_coordination_email`
6. `prepare_cabinet_summary`
7. `create_work_item_drafts` — future write-capable tool, approval required
8. `record_human_approval` — future write-capable tool, approval required

## Backend Principle

Supabase remains the system of record. ChatGPT/MCP reads from Supabase and returns structured packets. The React workspace and the ChatGPT connector should use the same packet-generation logic so HPG does not maintain two conflicting onboarding standards.
