import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FinancialReviewStatus {
  id: string;
  ngo_id: string;
  fiscal_period_id: string;
  status: string;
  reviewer_id: string | null;
  comments: string | null;
  created_at: string;
  last_updated_at: string;
}

export function useFinancialReviewStatus(ngoId?: string, fiscalPeriodId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["financial_review_status", ngoId, fiscalPeriodId],
    enabled: !!ngoId,
    queryFn: async () => {
      let q = supabase.from("financial_review_status" as any).select("*").eq("ngo_id", ngoId!);
      if (fiscalPeriodId) q = q.eq("fiscal_period_id", fiscalPeriodId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as FinancialReviewStatus[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (review: Omit<FinancialReviewStatus, "id" | "created_at" | "last_updated_at"> & { id?: string }) => {
      if (review.id) {
        const { id, ...updates } = review;
        const { data, error } = await supabase.from("financial_review_status" as any).update(updates as any).eq("id", id).select().single();
        if (error) throw error;
        return data as unknown as FinancialReviewStatus;
      } else {
        const { data, error } = await supabase.from("financial_review_status" as any).insert(review as any).select().single();
        if (error) throw error;
        return data as unknown as FinancialReviewStatus;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["financial_review_status"] }),
  });

  return { ...query, upsert };
}
