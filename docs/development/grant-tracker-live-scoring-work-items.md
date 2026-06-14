# Grant Tracker Phase 2: Live Scoring + Work Items

This clean rebuild follows PR #74.

PR #74 already merged:

- production grant tracker schema
- starter grant source/opportunity data
- hardened grant opportunity and application hooks

This PR intentionally focuses only on the next useful layer:

- score live NGOs against live grant opportunities
- keep Grant STW demo data only as fallback
- generate draft proposal text from a match
- create a Development work item from a grant match
- create a linked grant application record with score, notes, deadline, draft text, and work item ID

Resulting workflow:

`Live NGO + live grant opportunity -> STW match score -> draft proposal -> Development work item -> grant application record`

Next recommended phase:

Split a selected grant match into multiple department work items:

- Development: needs statement, demographics, research, statistics
- Finance: budget, fiscal review, indirect/admin cost assumptions
- Communications: LOI, mission, vision, organizational background
- NGO Coordination: questionnaire follow-up and missing document packet
