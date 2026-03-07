import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useTimesheets(filters?: { status?: string; staff_id?: string; ngo_id?: string }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["timesheets", filters],
    queryFn: async () => {
      let q = supabase.from("timesheets")
        .select("*, staff_profiles(first_name, last_name), ngos(legal_name, common_name)")
        .order("period_start", { ascending: false });
      if (filters?.status) q = q.eq("status", filters.status);
      if (filters?.staff_id) q = q.eq("staff_id", filters.staff_id);
      if (filters?.ngo_id) q = q.eq("ngo_id", filters.ngo_id);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (ts: { staff_id: string; ngo_id: string; period_start: string; period_end: string; total_hours?: number; notes?: string }) => {
      const { data, error } = await supabase.from("timesheets").insert(ts).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["timesheets"] }); toast.success("Timesheet created"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, approved_by_user_id }: { id: string; status: string; approved_by_user_id?: string }) => {
      const updates: Record<string, unknown> = { status };
      if (status === "submitted") updates.submitted_at = new Date().toISOString();
      if (status === "approved" && approved_by_user_id) { updates.approved_by_user_id = approved_by_user_id; updates.approved_at = new Date().toISOString(); }
      const { error } = await supabase.from("timesheets").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["timesheets"] }); toast.success("Timesheet updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateHours = useMutation({
    mutationFn: async ({ id, total_hours }: { id: string; total_hours: number }) => {
      const { error } = await supabase.from("timesheets").update({ total_hours }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["timesheets"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, create, updateStatus, updateHours };
}
