import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CompliancePackage {
  id: string;
  ngo_id: string;
  fiscal_year: number;
  package_type: string;
  status: string;
  data_json: any;
  file_path: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useCompliancePackages(ngoId?: string, fiscalYear?: number) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["compliance_packages", ngoId, fiscalYear],
    enabled: !!ngoId,
    queryFn: async () => {
      let q = (supabase as any).from("compliance_packages").select("*").eq("ngo_id", ngoId!).order("created_at", { ascending: false });
      if (fiscalYear) q = q.eq("fiscal_year", fiscalYear);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as CompliancePackage[];
    },
  });

  const create = useMutation({
    mutationFn: async (pkg: Omit<CompliancePackage, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await (supabase as any).from("compliance_packages").insert(pkg).select().single();
      if (error) throw error;
      return data as CompliancePackage;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["compliance_packages"] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CompliancePackage> & { id: string }) => {
      const { data, error } = await (supabase as any).from("compliance_packages").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data as CompliancePackage;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["compliance_packages"] }),
  });

  return { ...query, create, update };
}
