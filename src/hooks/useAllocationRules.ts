import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AllocationRule {
  id: string;
  name: string;
  basis_type: string;
  source_cost_center_id: string | null;
  target_scope_type: string;
  rule_config_json: Record<string, any>;
  offset_account_id: string | null;
  expense_account_id: string | null;
  effective_start_date: string;
  effective_end_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useAllocationRules() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["allocation_rules"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("allocation_rules").select("*, cost_centers:source_cost_center_id(code, name)").order("name");
      if (error) throw error;
      return (data || []) as (AllocationRule & { cost_centers: { code: string; name: string } | null })[];
    },
  });

  const create = useMutation({
    mutationFn: async (rule: Omit<AllocationRule, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await (supabase as any).from("allocation_rules").insert(rule).select().single();
      if (error) throw error;
      return data as AllocationRule;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["allocation_rules"] }); toast.success("Allocation rule created"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AllocationRule> & { id: string }) => {
      const { data, error } = await (supabase as any).from("allocation_rules").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data as AllocationRule;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["allocation_rules"] }); toast.success("Rule updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, create, update };
}
