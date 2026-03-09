import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const db = () => supabase as any;

export function useLocalizedCOA() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["localized_coa"],
    queryFn: async () => {
      const { data, error } = await db().from("localized_coa_mappings").select("*, accounts(code, name)").order("country_code");
      if (error) throw error;
      return data as any[];
    },
  });

  const create = useMutation({
    mutationFn: async (mapping: { country_code: string; local_account_code: string; local_account_name: string; standard_account_id?: string; mapping_notes?: string }) => {
      const { data, error } = await db().from("localized_coa_mappings").insert(mapping).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["localized_coa"] }); toast.success("Mapping created"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db().from("localized_coa_mappings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["localized_coa"] }); toast.success("Mapping removed"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, create, remove };
}
