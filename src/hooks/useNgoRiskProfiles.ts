import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useNgoRiskProfiles(ngoId?: string) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["ngo_risk_profiles", ngoId],
    queryFn: async () => {
      let q = supabase!.from("ngo_risk_profiles")
        .select("*, ngos(legal_name, common_name)")
        .order("overall_risk_score", { ascending: false });
      if (ngoId) q = q.eq("ngo_id", ngoId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!supabase,
  });

  const upsert = useMutation({
    mutationFn: async (profile: {
      ngo_id: string;
      financial_risk_score?: number;
      compliance_risk_score?: number;
      hr_risk_score?: number;
      operations_risk_score?: number;
      overall_risk_score?: number;
      risk_level?: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase!.from("ngo_risk_profiles")
        .upsert(profile, { onConflict: "ngo_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ngo_risk_profiles"] });
      toast.success("Risk profile updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, upsert };
}
