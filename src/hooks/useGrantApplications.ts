import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface GrantApplicationRecord {
  id: string;
  opportunity_id?: string | null;
  ngo_id?: string | null;
  title: string;
  stage: string;
  amount_requested?: number | null;
  amount_awarded?: number | null;
  currency?: string | null;
  assigned_user_id?: string | null;
  source_match_score?: number | null;
  fit_notes?: string | null;
  notes?: string | null;
  due_date?: string | null;
  submitted_at?: string | null;
  awarded_at?: string | null;
  closed_at?: string | null;
  grant_opportunities?: { id: string; title: string; deadline?: string | null; grant_sources?: { id: string; name: string } | null } | null;
  ngos?: { legal_name: string; common_name?: string | null } | null;
  profiles?: { full_name?: string | null } | null;
}

export function useGrantApplications(filters?: { stage?: string; ngo_id?: string }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["grant_applications", filters],
    queryFn: async () => {
      let q = (supabase as any)
        .from("grant_applications")
        .select("*, grant_opportunities(id, title, deadline, grant_sources(id, name)), ngos(legal_name, common_name), profiles(full_name)")
        .order("created_at", { ascending: false });

      if (filters?.stage && filters.stage !== "all") q = q.eq("stage", filters.stage);
      if (filters?.ngo_id) q = q.eq("ngo_id", filters.ngo_id);

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as GrantApplicationRecord[];
    },
  });

  const create = useMutation({
    mutationFn: async (app: {
      title: string;
      ngo_id?: string;
      opportunity_id?: string;
      stage?: string;
      amount_requested?: number;
      assigned_user_id?: string;
      source_match_score?: number;
      fit_notes?: string;
      notes?: string;
      due_date?: string;
    }) => {
      const { data, error } = await (supabase as any)
        .from("grant_applications")
        .insert(app)
        .select()
        .single();
      if (error) throw error;
      return data as GrantApplicationRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grant_applications"] });
      toast.success("Application created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStage = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const updates: Record<string, unknown> = { stage };
      if (stage === "submitted") updates.submitted_at = new Date().toISOString();
      if (stage === "awarded") updates.awarded_at = new Date().toISOString();
      if (stage === "closed") updates.closed_at = new Date().toISOString();

      const { error } = await (supabase as any).from("grant_applications").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grant_applications"] });
      toast.success("Stage updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, create, updateStage };
}
