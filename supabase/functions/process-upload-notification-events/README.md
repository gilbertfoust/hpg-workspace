# process-upload-notification-events

Processes queued rows in `upload_notification_events` and dispatches Slack or email notifications using `department_notification_routes`.

## Invoke

```bash
curl -X POST "$SUPABASE_URL/functions/v1/process-upload-notification-events" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'
```

Requires an internal staff JWT. Configure Slack webhook secret names on `department_notification_routes` (same pattern as form workflow events).
