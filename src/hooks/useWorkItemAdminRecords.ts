import { useQuery } from "@tanstack/react-query";
import { ensureSupabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type WorkItemAdminRecord = Database["public"]["Tables"]["work_item_admin_records"]["Row"];

export const useWorkItemAdminRecords = () => {
  return useQuery({
    queryKey: ["work-item-admin-records"],
    queryFn: async (): Promise<WorkItemAdminRecord[]> => {
      const supabase = ensureSupabase();
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
