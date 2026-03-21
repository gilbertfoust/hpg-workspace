import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function usePayRuns(ngoId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["pay_runs", ngoId],
    queryFn: async () => {
      let q = supabase.from("pay_runs")
        .select("*, ngos(legal_name, common_name)")
        .order("pay_period_end", { ascending: false });
      if (ngoId) q = q.eq("ngo_id", ngoId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (run: { ngo_id: string; pay_period_start: string; pay_period_end: string; run_date?: string; notes?: string; created_by_user_id?: string }) => {
      const { data, error } = await supabase.from("pay_runs").insert(run).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["pay_runs"] }); toast.success("Pay run created"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("pay_runs").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["pay_runs"] }); toast.success("Pay run updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, create, updateStatus };
}

export function usePayRunItems(payRunId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["pay_run_items", payRunId],
    queryFn: async () => {
      const { data, error } = await supabase.from("pay_run_items")
        .select("*, staff_profiles(first_name, last_name, hourly_rate, annual_salary, employment_type)")
        .eq("pay_run_id", payRunId!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!payRunId,
  });

  const create = useMutation({
    mutationFn: async (item: { pay_run_id: string; staff_id: string; regular_hours: number; overtime_hours?: number; gross_pay: number; deductions?: Record<string, number>; net_pay: number }) => {
      const { data, error } = await supabase.from("pay_run_items").insert(item).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["pay_run_items"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, create };
}
