import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AllocationRun {
  id: string;
  fiscal_period_id: string;
  name: string;
  status: string;
  notes: string;
  created_by_user_id: string | null;
  created_at: string;
  posted_at: string | null;
}

export function useAllocationRuns(fiscalPeriodId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["allocation_runs", fiscalPeriodId],
    queryFn: async () => {
      let q = (supabase as any).from("allocation_runs").select("*").order("created_at", { ascending: false });
      if (fiscalPeriodId) q = q.eq("fiscal_period_id", fiscalPeriodId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as AllocationRun[];
    },
  });

  const create = useMutation({
    mutationFn: async (run: Omit<AllocationRun, "id" | "created_at" | "posted_at">) => {
      const { data, error } = await (supabase as any).from("allocation_runs").insert(run).select().single();
      if (error) throw error;
      return data as AllocationRun;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["allocation_runs"] }); toast.success("Allocation run created"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, posted_at }: { id: string; status: string; posted_at?: string }) => {
      const updates: any = { status };
      if (posted_at) updates.posted_at = posted_at;
      const { data, error } = await (supabase as any).from("allocation_runs").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data as AllocationRun;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allocation_runs"] });
      queryClient.invalidateQueries({ queryKey: ["allocation_results"] });
      toast.success("Run status updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, create, updateStatus };
}
