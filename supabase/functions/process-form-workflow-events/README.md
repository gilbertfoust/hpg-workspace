# Process Form Workflow Events

This Supabase Edge Function is the first server-side processor for form workflow events.

## Current Behavior

The scaffold reads queued records from `form_notification_events` and marks them as processed.

At this stage, real external delivery is not enabled. Events with destinations are marked `skipped` with a note that the delivery provider is not configured.

## Why This Exists

This lets HPG test the workflow lifecycle safely:

1. Form submitted.
2. Work item created or linked.
3. Workflow event queued.
4. Processor handles the queued event.
5. Event status changes from `queued` to `skipped`, `sent`, or `failed`.

## Required Environment Variables

These are required for the function runtime:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Do not expose the service-role key in frontend code.

## Future Provider Variables

Provider-specific keys should be added only after HPG is ready to send real external messages.

Recommended future names:

```text
SLACK_WEBHOOK_URL
RESEND_API_KEY
FORM_WORKFLOW_FROM_EMAIL
```

## Test Request

```bash
curl -X POST \
  "$SUPABASE_FUNCTION_URL/process-form-workflow-events" \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'
```

## Safety Boundary

This function should never be called from public unauthenticated pages without review. Keep deployment settings aligned with HPG's internal operations model.
