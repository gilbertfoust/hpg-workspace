import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface GrantRestrictionRule {
  id: string;
  grant_application_id: string | null;
  cost_center_id: string | null;
  allowed_account_ids_json: string[];
  restricted_categories_json: string[];
  notes: string;
  is_active: boolean;
  created_at: string;
}

export function useGrantRestrictionRules(costCenterId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["grant_restriction_rules", costCenterId],
    queryFn: async () => {
      let q = (supabase as any).from("grant_restriction_rules").select("*").eq("is_active", true);
      if (costCenterId) q = q.eq("cost_center_id", costCenterId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as GrantRestrictionRule[];
    },
  });

  const create = useMutation({
    mutationFn: async (rule: Omit<GrantRestrictionRule, "id" | "created_at">) => {
      const { data, error } = await (supabase as any).from("grant_restriction_rules").insert(rule).select().single();
      if (error) throw error;
      return data as GrantRestrictionRule;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["grant_restriction_rules"] }); toast.success("Restriction rule created"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, create };
}
