import { useQuery } from "@tanstack/react-query";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";

export interface FormWorkflowEvent {
  id: string;
  form_submission_id: string;
  form_template_id: string;
  work_item_id: string | null;
  module: string;
  notification_type: "slack" | "email";
  notification_status: "queued" | "sent" | "skipped" | "failed";
  recipient: string | null;
  error_message: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
  processed_at: string | null;
}

const ensureSupabase = () => {
  if (!supabase) throw getSupabaseNotConfiguredError();
  return supabase;
};

export const useFormWorkflowEvents = () => {
  return useQuery<FormWorkflowEvent[]>({
    queryKey: ["form-workflow-events"],
    enabled: !!supabase,
    queryFn: async () => {
      const client = ensureSupabase();
      const { data, error } = await client
        .from("form_notification_events" as never)
        .select("*" as never)
        .order("created_at" as never, { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data || []) as unknown as FormWorkflowEvent[];
    },
  });
};
