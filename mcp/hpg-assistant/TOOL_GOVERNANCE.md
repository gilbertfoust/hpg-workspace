# HPG Assistant MCP Tool Governance

This document defines how tools should be added to the HPG Assistant MCP server.

## Governance Principle

The MCP server is an operational bridge into the HPG Workspace. It must not become an uncontrolled automation layer.

Supabase remains the system of record. MCP tools should read from Supabase, generate structured drafts, and preserve human review unless a future approval workflow explicitly authorizes writes.

## Current Tool Registry

| Tool | Status | Access Type | Writes Data | Purpose |
|---|---|---:|---:|---|
| `search_ngos` | Active | Read-only | No | Search NGO records by name or country. |
| `generate_onboarding_packet` | Active | Read-only / draft-generation | No | Generate draft NGO Coordination packet from NGO and work item data. |
| `get_saved_packets` | Active | Read-only | No | Retrieve saved Assistant packet records for an NGO. |
| `get_packet_history` | Active | Read-only | No | Retrieve Assistant packet event timeline for an NGO. |

## Approved MVP Tool Boundary

MVP tools may:

- read NGO records,
- read work items,
- read saved Assistant packets,
- read packet event history,
- generate draft text,
- prepare summaries,
- return structured JSON.

MVP tools may not:

- send emails,
- create Gmail drafts,
- approve packets,
- create work items,
- modify NGO status,
- modify financial records,
- modify contract records,
- publish donor-facing content,
- represent a decision as final without human approval.

## Future Write Tool Approval Gate

Before any write-capable MCP tool is added, HPG should have all of the following:

1. Role-based authorization rules.
2. Supabase RLS policies reviewed and enabled where appropriate.
3. Audit logging for every tool call.
4. A human approval state in the database.
5. A visible review screen in the HPG Workspace.
6. Clear rollback or archive behavior.
7. Test coverage proving the tool cannot bypass approval.

## Future Write Tools Requiring Governance Review

| Proposed Tool | Required Approval Before Use |
|---|---|
| `save_assistant_packet` | NGO Coordinator or authorized department lead |
| `approve_assistant_packet` | CEO, EVP, NGO Coordination lead, or authorized admin |
| `create_work_item_drafts` | Department lead or assigned coordinator |
| `create_gmail_draft` | Communications/NGO Coordination review |
| `send_email` | Explicit human send confirmation only |
| `update_ngo_status` | Departmental and executive authorization |

## Tool Design Requirements

Every new tool should include:

- clear description,
- input schema with strict validation,
- explicit statement of read/write behavior,
- least-privilege data selection,
- no service-role leakage,
- safe error messages,
- audit event design if write-capable,
- test plan update.

## Naming Convention

Use action-oriented tool names:

- `search_ngos`
- `get_saved_packets`
- `generate_onboarding_packet`
- `prepare_cabinet_summary`
- `draft_ngo_coordination_email`

Avoid vague names such as:

- `do_task`
- `run_agent`
- `update_everything`
- `auto_process`

## Security Notes

The service-role key must stay only in the MCP server environment. It must never appear in:

- frontend source code,
- browser-accessible environment variables,
- GitHub committed files,
- ChatGPT prompts,
- screenshots,
- logs returned to users.

## Change Checklist

Before merging a new MCP tool:

- [ ] Tool is listed in this registry.
- [ ] Tool behavior is marked read-only or write-capable.
- [ ] Test plan is updated.
- [ ] Safety boundaries are documented.
- [ ] Secrets remain server-side.
- [ ] No unexpected tables or fields are exposed.
- [ ] Write tools have approval and audit logic before use.
