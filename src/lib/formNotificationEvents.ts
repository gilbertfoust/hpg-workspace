import { supabase } from "@/integrations/supabase/client";
import type { FormTemplate } from "@/hooks/useFormTemplates";
import type { Json } from "@/integrations/supabase/types";

interface CreateFormNotificationEventsInput {
  template: Pick<FormTemplate, "id" | "name" | "module">;
  submissionId: string;
  workItemId?: string | null;
  ngoId?: string | null;
  payloadJson?: Json;
}

export async function createFormNotificationEvents({
  template,
  submissionId,
  workItemId,
  ngoId,
  payloadJson,
}: CreateFormNotificationEventsInput) {
  if (!supabase) return;

  const { data: route, error: routeError } = await supabase
    .from("department_notification_routes" as never)
    .select("module, department_name, slack_channel, email_recipients, is_active" as never)
    .eq("module" as never, template.module as never)
    .eq("is_active" as never, true as never)
    .maybeSingle();

  if (routeError || !route) {
    console.info("[formNotificationEvents] No active route for", template.module);
    return;
  }

  const routeRecord = route as unknown as {
    module: string;
    department_name: string;
    slack_channel?: string | null;
    email_recipients?: string[] | null;
  };

  const metadata = {
    form_name: template.name,
    department_name: routeRecord.department_name,
    ngo_id: ngoId || null,
    payload_preview: payloadJson && typeof payloadJson === "object" ? payloadJson : null,
  };

  const rows: Record<string, unknown>[] = [];

  if (routeRecord.slack_channel) {
    rows.push({
      form_submission_id: submissionId,
      form_template_id: template.id,
      work_item_id: workItemId || null,
      module: template.module,
      notification_type: "slack",
      notification_status: "queued",
      recipient: routeRecord.slack_channel,
      metadata_json: metadata,
    });
  }

  const recipients = Array.isArray(routeRecord.email_recipients) ? routeRecord.email_recipients : [];
  recipients.forEach((recipient) => {
    rows.push({
      form_submission_id: submissionId,
      form_template_id: template.id,
      work_item_id: workItemId || null,
      module: template.module,
      notification_type: "email",
      notification_status: "queued",
      recipient,
      metadata_json: metadata,
    });
  });

  if (rows.length === 0) {
    rows.push({
      form_submission_id: submissionId,
      form_template_id: template.id,
      work_item_id: workItemId || null,
      module: template.module,
      notification_type: "email",
      notification_status: "skipped",
      recipient: null,
      metadata_json: { ...metadata, reason: "No recipients configured." },
    });
  }

  const { error } = await supabase.from("form_notification_events" as never).insert(rows as never);
  if (error) {
    console.warn("[formNotificationEvents] Could not create events", error);
  }
}
