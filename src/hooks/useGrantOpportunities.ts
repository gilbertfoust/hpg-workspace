import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface GrantOpportunityRecord {
  id: string;
  source_id?: string | null;
  external_id?: string | null;
  title: string;
  funder_name?: string | null;
  description?: string | null;
  eligibility_summary?: string | null;
  country?: string | null;
  region?: string | null;
  focus_areas?: string[];
  keywords?: string[];
  min_award?: number | null;
  max_award?: number | null;
  currency?: string | null;
  deadline?: string | null;
  open_date?: string | null;
  close_date?: string | null;
  status?: string | null;
  url?: string | null;
  grant_sources?: { id: string; name: string; funder_type?: string | null } | null;
}

export function useGrantOpportunities(filters?: { status?: string; country?: string; search?: string }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["grant_opportunities", filters],
    queryFn: async () => {
      let q = (supabase as any)
        .from("grant_opportunities")
        .select("*, grant_sources(id, name, funder_type)")
        .order("deadline", { ascending: true, nullsFirst: false });

      if (filters?.status && filters.status !== "all") q = q.eq("status", filters.status);
      if (filters?.country) q = q.eq("country", filters.country);
      if (filters?.search) q = q.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%,funder_name.ilike.%${filters.search}%`);

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as GrantOpportunityRecord[];
    },
  });

  const create = useMutation({
    mutationFn: async (opp: {
      title: string;
      source_id?: string;
      external_id?: string;
      funder_name?: string;
      description?: string;
      eligibility_summary?: string;
      country?: string;
      region?: string;
      focus_areas?: string[];
      keywords?: string[];
      min_award?: number;
      max_award?: number;
      currency?: string;
      deadline?: string;
      open_date?: string;
      close_date?: string;
      status?: string;
      url?: string;
      source_payload?: Record<string, unknown>;
    }) => {
      const { data, error } = await (supabase as any)
        .from("grant_opportunities")
        .insert(opp)
        .select()
        .single();
      if (error) throw error;
      return data as GrantOpportunityRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grant_opportunities"] });
      toast.success("Opportunity created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, create };
}
