import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClosingEntry {
  id: string;
  ngo_id: string;
  fiscal_year: number;
  account_id: string;
  debit: number;
  credit: number;
  memo: string | null;
  created_by_user_id: string | null;
  created_at: string;
}

export function useClosingEntries(ngoId?: string, fiscalYear?: number) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["closing_entries", ngoId, fiscalYear],
    enabled: !!ngoId && !!fiscalYear,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("closing_entries")
        .select("*, accounts(code, name, type)")
        .eq("ngo_id", ngoId!)
        .eq("fiscal_year", fiscalYear!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as (ClosingEntry & { accounts: { code: string; name: string; type: string } })[];
    },
  });

  const createBatch = useMutation({
    mutationFn: async (entries: Omit<ClosingEntry, "id" | "created_at">[]) => {
      const { data, error } = await (supabase as any).from("closing_entries").insert(entries).select();
      if (error) throw error;
      return data as ClosingEntry[];
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["closing_entries"] }),
  });

  return { ...query, createBatch };
}
