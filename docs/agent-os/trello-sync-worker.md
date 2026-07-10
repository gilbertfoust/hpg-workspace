# Agent OS Trello Synchronization Worker

Status: **implemented in code; no Trello credentials, mappings, cards, or live operations are active**.

## Purpose

The worker connects Supabase, the permanent Agent OS workflow record, to HPG's existing Trello department workspaces, boards, lists, template cards, checklists, and assignments. It does not replace or redesign the current Trello architecture.

## Safety gates

Live Trello processing requires all of the following:

1. Agent OS runtime and Trello-route migrations deployed.
2. Approved `trello_route_mappings` records created after inventorying the real Trello workspaces and boards.
3. `TRELLO_API_KEY` and `TRELLO_API_TOKEN` installed as Supabase secrets.
4. `AGENT_OS_WORKER_SECRET` installed, or invocation by an authenticated internal user.
5. `AGENT_OS_TRELLO_LIVE=true` installed.
6. Request body explicitly contains `"live": true`.

Missing any condition prevents live Trello operations.

## Supported operations

- `create_card`: creates a card in an approved mapped list and may copy an approved template card.
- `update_card`: updates supported card fields.
- `move_card`: moves an existing card to an approved list through a controlled payload.

The first release supports only Supabase-to-Trello synchronization. Trello-to-Supabase webhook ingestion remains a separate controlled phase.

## Route mappings

Every live card creation requires an active route mapping containing:

- route key;
- department module;
- optional subdepartment or function;
- optional case type;
- existing Trello workspace ID;
- board ID;
- list ID;
- optional template card ID;
- optional default labels and members.

A missing or incomplete mapping blocks the queue item rather than guessing a destination.

## Dry-run invocation

```json
{
  "limit": 10,
  "live": false
}
```

Dry run returns pending queue items with route readiness and performs no claim or external action.

## Live invocation

```json
{
  "limit": 10,
  "live": true
}
```

Live mode must remain disabled until a Trello sandbox or carefully selected test board is configured.

## Retry and recovery

- First failure: retry after 5 minutes.
- Second failure: retry after 15 minutes.
- Third failure: mark failed and preserve the error.
- Processing locks older than 15 minutes are recovered.
- Missing route mappings are blocked immediately and require an internal configuration decision.
- Queue idempotency keys prevent duplicate work creation for the same source event.

## Trello inventory required before activation

For each HPG department and function, record:

- workspace name and ID;
- board name and ID;
- list names and IDs;
- template cards and IDs;
- custom fields;
- labels;
- assigned roles or member IDs;
- Butler automations;
- email-to-board addresses currently in use;
- card naming conventions;
- checklist ownership and completion rules;
- archive and rejection lists;
- dependencies on Make.com or other automations.

## Pilot route

The first route should be NGO Coordination or a dedicated Trello sandbox. It should use a fabricated NGO case and verify:

1. one queue event creates one card;
2. permanent HPG reference appears in the card name or description;
3. the approved template card is copied;
4. Director and coordinator checklists remain intact;
5. the created card ID and URL return to Supabase;
6. repeated processing does not create a duplicate;
7. move and update operations work only on the expected card;
8. missing mappings and unsupported operations fail safely;
9. run logs contain evidence without credentials;
10. live mode can be disabled immediately.

## Production checklist

- [ ] Inventory current Trello architecture.
- [ ] Create route mappings through an internal configuration screen or controlled SQL.
- [ ] Create a dedicated test board or approved test list.
- [ ] Install test credentials as secrets.
- [ ] Keep `AGENT_OS_TRELLO_LIVE` unset during dry-run testing.
- [ ] Confirm pending items appear with route readiness.
- [ ] Enable live mode in test only.
- [ ] Test create, update, move, retries, and duplicate prevention.
- [ ] Verify Supabase case and work-item identifiers update correctly.
- [ ] Obtain Technology and department-supervisor approval.
- [ ] Deploy to production with live mode disabled.
- [ ] Run a production dry run.
- [ ] Enable during a controlled window and monitor the first cards.
