import { supabase } from "@/integrations/supabase/client";
import type { ModuleType } from "@/hooks/useWorkItems";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/integrations/supabase/types";

type UploadEvent = {
  id: string; work_item_id: string; document_id: string | null; module: string;
  department_id: string | null; notification_type: "slack" | "email";
  notification_status: "queued" | "sent" | "skipped" | "failed";
  recipient: string | null; error_message: string | null; metadata_json: Json;
  created_at: string; processed_at: string | null;
};
type UploadEventDatabase = { public: { Tables: { upload_notification_events: {
  Row: UploadEvent; Insert: Pick<UploadEvent, "work_item_id" | "module" | "notification_type"> & Partial<UploadEvent>;
  Update: Partial<UploadEvent>; Relationships: [];
} }; Views: {}; Functions: {} } };

export interface QueueUploadNotificationInput {
  workItemId: string;
  documentId: string;
  module: ModuleType;
  departmentId?: string | null;
  fileName?: string;
  departmentName?: string | null;
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
    notification_type: "slack" as const,
    notification_status: "queued" as const,
    metadata_json: {
      source: "document_upload",
      file_name: input.fileName ?? null,
      department_name: input.departmentName ?? null,
    },
  };

  const eventClient = supabase as unknown as SupabaseClient<UploadEventDatabase>;
  const { error } = await eventClient.from("upload_notification_events").insert(payload);

  if (error) {
    return {
      queued: false,
      message:
        "Upload routed successfully. Slack notification queue is not available yet — apply the upload_notification_events migration to enable dispatch.",
    };
  }

  try {
    await supabase.functions.invoke("process-upload-notification-events", {
      body: { limit: 1 },
    });
  } catch {
    // Non-blocking: queued events can be processed manually or by automation.
  }

  return {
    queued: true,
    message: "Upload routed and Slack notification queued for the receiving department.",
  };
}
