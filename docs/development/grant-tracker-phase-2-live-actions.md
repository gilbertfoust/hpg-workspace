# Grant Tracker Phase 2: Live Actions

This branch is a clean follow-up after PR #74.

PR #74 already added the production grant schema and hardened live grant hooks. This branch only adds the next operational layer:

- score live NGOs against live grant opportunities
- keep Grant STW demo data only as fallback
- generate draft proposal text from a live match
- create a Development work item from a strong match
- create a linked grant application record with fit score, notes, deadline, draft text, and work item ID

Workflow:

`Live NGO + Live Opportunity → Match Score → Draft → Development Work Item → Grant Application Record`

Next recommended step:

Split the grant-writing work item into departmental tasks for Development, Finance, Communications, and NGO Coordination.
