import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const db = () => supabase as any;

export function useTreasuryPositions(filters?: { ngo_id?: string }) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["treasury_positions", filters],
    queryFn: async () => {
      let q = db().from("treasury_positions").select("*, ngos(legal_name, common_name)").order("account_name");
      if (filters?.ngo_id) q = q.eq("ngo_id", filters.ngo_id);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  const create = useMutation({
    mutationFn: async (pos: { ngo_id?: string; account_name: string; bank_name?: string; currency?: string; current_balance?: number; as_of_date?: string; account_type?: string; notes?: string }) => {
      const { data, error } = await db().from("treasury_positions").insert(pos).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["treasury_positions"] }); toast.success("Account added"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, unknown>) => {
      const { error } = await db().from("treasury_positions").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["treasury_positions"] }); toast.success("Account updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, create, update };
}
