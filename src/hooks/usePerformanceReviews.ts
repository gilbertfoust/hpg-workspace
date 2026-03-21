import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function usePerformanceReviews(filters?: { staff_id?: string; status?: string }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["performance_reviews", filters],
    queryFn: async () => {
      let q = supabase.from("performance_reviews")
        .select("*, staff_profiles(first_name, last_name), ngos(legal_name, common_name), profiles!performance_reviews_reviewer_user_id_fkey(full_name)")
        .order("review_period_end", { ascending: false });
      if (filters?.staff_id) q = q.eq("staff_id", filters.staff_id);
      if (filters?.status) q = q.eq("status", filters.status);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (review: { staff_id: string; ngo_id?: string; reviewer_user_id?: string; review_period_start: string; review_period_end: string }) => {
      const { data, error } = await supabase.from("performance_reviews").insert(review).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["performance_reviews"] }); toast.success("Review created"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, unknown>) => {
      const { error } = await supabase.from("performance_reviews").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["performance_reviews"] }); toast.success("Review updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, create, update };
}
