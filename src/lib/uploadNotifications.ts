import { supabase } from "@/integrations/supabase/client";
import type { ModuleType } from "@/hooks/useWorkItems";

export interface QueueUploadNotificationInput {
  workItemId: string;
  documentId: string;
  module: ModuleType;
  departmentId?: string | null;
}

/**
 * Queues a Slack notification event when the upload_notification_events table exists.
 * Does not fake delivery — records a pending integration event for a future edge function.
 */
export async function queueUploadNotification(input: QueueUploadNotificationInput): Promise<{
  queued: boolean;
  message: string;
}> {
  if (!supabase) {
    return { queued: false, message: "Supabase not configured." };
  }

  const payload = {
    work_item_id: input.workItemId,
    document_id: input.documentId,
    module: input.module,
    department_id: input.departmentId ?? null,
    notification_type: "slack",
    notification_status: "queued",
    metadata_json: {
      source: "document_upload",
      integration: "pending_slack_processor",
    },
  };

  const { error } = await supabase
    .from("upload_notification_events" as never)
    .insert(payload as never);

  if (error) {
    return {
      queued: false,
      message:
        "Upload routed successfully. Slack notification queue is not available yet — apply the upload_notification_events migration to enable dispatch.",
    };
  }

  return {
    queued: true,
    message: "Upload routed and Slack notification queued for the receiving department.",
  };
}
