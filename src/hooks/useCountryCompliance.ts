import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const db = () => supabase as any;

export function useCountryCompliance() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["country_compliance"],
    queryFn: async () => {
      const { data, error } = await db().from("country_compliance_profiles").select("*").order("country_name");
      if (error) throw error;
      return data as any[];
    },
  });

  const create = useMutation({
    mutationFn: async (profile: { country_code: string; country_name: string; registration_required?: boolean; tax_filing_required?: boolean; annual_audit_required?: boolean; filing_deadline?: string; regulatory_body?: string; notes?: string }) => {
      const { data, error } = await db().from("country_compliance_profiles").insert(profile).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["country_compliance"] }); toast.success("Profile created"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, unknown>) => {
      const { error } = await db().from("country_compliance_profiles").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["country_compliance"] }); toast.success("Profile updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, create, update };
}
