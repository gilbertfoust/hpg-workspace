import { useQuery } from "@tanstack/react-query";
import { ensureSupabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModuleType } from "@/hooks/useWorkItems";

export type WorkItemAdminRecord = {
  id: string; work_item_id: string; title: string; module: ModuleType | null;
  department_id: string | null; ngo_id: string | null; completed_at: string;
  archive_reason: string; record_status: "queued" | "reviewed" | "filed"; notes: string | null; created_at: string;
};
type AdminRecordDatabase = { public: { Tables: { work_item_admin_records: {
  Row: WorkItemAdminRecord; Insert: Partial<WorkItemAdminRecord>; Update: Partial<WorkItemAdminRecord>; Relationships: [];
} }; Views: {}; Functions: {} } };

export const useWorkItemAdminRecords = () => {
  return useQuery({
    queryKey: ["work-item-admin-records"],
    queryFn: async (): Promise<WorkItemAdminRecord[]> => {
      const supabase = ensureSupabase() as unknown as SupabaseClient<AdminRecordDatabase>;
      const { data, error } = await supabase
        .from("work_item_admin_records")
        .select("id, work_item_id, title, module, department_id, ngo_id, completed_at, archive_reason, record_status, notes, created_at")
        .order("completed_at", { ascending: false })
        .limit(100);

      if (error) {
        console.warn("Admin records unavailable:", error.message);
        return [];
      }

      return (data ?? []) as WorkItemAdminRecord[];
    },
  });
};
