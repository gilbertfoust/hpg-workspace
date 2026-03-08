import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AllocationResult {
  id: string;
  allocation_run_id: string;
  allocation_rule_id: string;
  source_usage_entry_id: string;
  source_cost_center_id: string | null;
  target_cost_center_id: string;
  allocated_amount: number;
  journal_transaction_id: string | null;
  details_json: Record<string, any>;
  created_at: string;
}

export function useAllocationResults(runId?: string) {
  return useQuery({
    queryKey: ["allocation_results", runId],
    enabled: !!runId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("allocation_results")
        .select("*, source_cc:source_cost_center_id(code, name), target_cc:target_cost_center_id(code, name), allocation_rules(name)")
        .eq("allocation_run_id", runId!)
        .order("created_at");
      if (error) throw error;
      return (data || []) as (AllocationResult & {
        source_cc: { code: string; name: string } | null;
        target_cc: { code: string; name: string } | null;
        allocation_rules: { name: string } | null;
      })[];
    },
  });
}
