import { useQuery } from "@tanstack/react-query";
import { ensureSupabase } from "@/integrations/supabase/client";

export type WorkItemAdminRecord = {
  id: string;
  work_item_id: string;
  title: string;
  module: string | null;
  department_id: string | null;
  ngo_id: string | null;
  completed_at: string;
  archive_reason: string;
  record_status: string;
  notes: string | null;
  created_at: string;
};

export const useWorkItemAdminRecords = () => {
  return useQuery({
    queryKey: ["work-item-admin-records"],
    queryFn: async (): Promise<WorkItemAdminRecord[]> => {
      const supabase = ensureSupabase();
      const { data, error } = await supabase
        .from("work_item_admin_records" as never)
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
