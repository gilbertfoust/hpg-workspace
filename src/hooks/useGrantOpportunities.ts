import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useGrantOpportunities(filters?: { status?: string; country?: string; search?: string }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["grant_opportunities", filters],
    queryFn: async () => {
      let q = supabase
        .from("grant_opportunities")
        .select("*, grant_sources(id, name, funder_type)")
        .order("deadline", { ascending: true, nullsFirst: false });

      if (filters?.status) q = q.eq("status", filters.status);
      if (filters?.country) q = q.eq("country", filters.country);
      if (filters?.search) q = q.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);

      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (opp: { title: string; source_id?: string; description?: string; country?: string; region?: string; focus_areas?: string[]; min_award?: number; max_award?: number; deadline?: string; status?: string; url?: string }) => {
      const { data, error } = await supabase.from("grant_opportunities").insert(opp).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grant_opportunities"] });
      toast.success("Opportunity created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, create };
}
