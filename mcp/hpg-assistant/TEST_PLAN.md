# HPG Assistant MCP Test Plan

## Goal

Verify that the private MCP server can safely read HPG Workspace data, generate draft-only NGO Coordination packets, and retrieve saved packet history without changing production records.

## Tools Under Test

### `search_ngos`

Expected behavior:

- Accepts a search query.
- Returns matching NGO records.
- Does not expose unrelated records beyond the query result.
- Does not write to the database.

Suggested test prompts:

```text
Search NGOs for Kenya.
Search NGOs for Mega.
Search NGOs for Ghana.
```

### `generate_onboarding_packet`

Expected behavior:

- Accepts an `ngo_id`.
- Reads the NGO record.
- Reads related `work_items`.
- Returns a draft packet with readiness reasons, missing documents, department checklist, intro email draft, and Cabinet summary.
- Does not save the packet.
- Does not approve the packet.
- Does not create work items.
- Does not send email.

Suggested test prompt:

```text
Generate an onboarding packet for NGO ID <uuid>.
```

### `get_saved_packets`

Expected behavior:

- Accepts an `ngo_id`.
- Optionally filters by status: `draft`, `reviewed`, `approved`, or `archived`.
- Returns saved Assistant packet metadata, summaries, email draft text, and Cabinet summary text.
- Does not create, update, approve, or archive packets.

Suggested test prompts:

```text
Get saved Assistant packets for NGO ID <uuid>.
Get approved Assistant packets for NGO ID <uuid>.
```

### `get_packet_history`

Expected behavior:

- Accepts an `ngo_id`.
- Returns packet event timeline records.
- Does not write new events.
- Does not modify approval status.

Suggested test prompt:

```text
Get the Assistant packet history for NGO ID <uuid>.
```

## Safety Verification

Confirm the MCP server cannot:

- send Gmail messages,
- create Gmail drafts,
- update Supabase records,
- approve assistant packets,
- create work items,
- modify `ngos`,
- modify financial tables,
- change sponsorship status,
- publish public communications.

## Database Verification Queries

Run these before and after MCP tests to confirm read-only behavior:

```sql
select count(*) from public.assistant_packets;
select count(*) from public.assistant_packet_events;
select count(*) from public.work_items where type = 'Assistant Recommendation';
```

The counts should not change after testing the read-only MCP tools.

## Pass Criteria

The MCP server passes the MVP readiness test when:

- `search_ngos` returns relevant NGO records.
- `generate_onboarding_packet` returns a coherent packet.
- `get_saved_packets` returns saved packet records without changing counts.
- `get_packet_history` returns event records without changing counts.
- no database write counts change.
- no external communication is sent.
- no service-role key is exposed to the frontend or repository.

## Fail Criteria

Stop deployment testing if:

- the service-role key appears in browser-accessible code,
- any read-only tool writes to Supabase,
- generated packets include public promises or funding commitments,
- errors expose sensitive credentials,
- the server returns unrelated sensitive data.
