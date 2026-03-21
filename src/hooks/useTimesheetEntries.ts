import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useTimesheetEntries(timesheetId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["timesheet_entries", timesheetId],
    queryFn: async () => {
      let q = supabase.from("timesheet_entries")
        .select("*, cost_centers(name)")
        .order("entry_date");
      if (timesheetId) q = q.eq("timesheet_id", timesheetId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!timesheetId,
  });

  const create = useMutation({
    mutationFn: async (entry: { timesheet_id: string; staff_id: string; entry_date: string; hours: number; description?: string; cost_center_id?: string }) => {
      const { data, error } = await supabase.from("timesheet_entries").insert(entry).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["timesheet_entries"] }); toast.success("Entry added"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("timesheet_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["timesheet_entries"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, create, remove };
}
