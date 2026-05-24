# Process Form Workflow Events

This Supabase Edge Function processes workflow events created when HPG forms are submitted and routed to departments.

## Supported Delivery Paths

The function supports:

1. Slack delivery through a department-specific incoming webhook secret.
2. Email delivery through Resend.

An event is sent only when its route is active and its required server-side provider settings exist. When a provider is not configured, the event is marked `skipped` with a clear reason rather than causing an unsafe or silent failure.

## Workflow Lifecycle

1. A form is submitted.
2. A work item is created or linked.
3. The form-submission trigger creates workflow event records.
4. This processor loads queued events.
5. It identifies the active department route.
6. It sends the Slack or email message when configuration is present.
7. It records the final event status as `sent`, `skipped`, or `failed`.

## Required Environment Variables

These Supabase-provided variables are required for the function runtime:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

The service-role key must remain server-side only.

## Email Provider Configuration

To enable department email delivery, install these Edge Function secrets:

```text
RESEND_API_KEY
FORM_WORKFLOW_FROM_EMAIL
```

`FORM_WORKFLOW_FROM_EMAIL` should be a verified sender identity in Resend, such as an HPG notifications address on a verified domain.

Then, configure each department's email recipients in **Forms → Routes**.

## Slack Provider Configuration

Each department route can store a server-secret identifier in `slack_webhook_secret_name`. The value should be the name of an Edge Function secret, not the actual webhook URL.

Example route value:

```text
SLACK_WEBHOOK_DEVELOPMENT
```

Then install that matching Edge Function secret with the department's Slack incoming webhook URL. Never store webhook URLs in browser-facing fields or committed repository files.

## Message Content

Slack and email messages intentionally contain a concise operational notice only:

- department name,
- submitted form name,
- workflow event ID,
- instruction to open the HPG Workspace for review.

The message does not include the complete form submission payload.

## Test Request

After deployment and secret configuration, an authorized caller may invoke:

```bash
curl -X POST \
  "$SUPABASE_FUNCTION_URL/process-form-workflow-events" \
  -H "Authorization: Bearer $AUTHENTICATED_USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'
```

## Safety Boundary

Keep `verify_jwt` enabled. Do not expose this function as a public unauthenticated endpoint. Provider secrets must remain in Supabase Edge Function secret storage and should never be placed in frontend code, route fields, or repository files.
