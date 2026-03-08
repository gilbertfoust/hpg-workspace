import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface InternalCharge {
  id: string;
  from_cost_center_id: string;
  to_cost_center_id: string;
  fiscal_period_id: string;
  description: string;
  amount: number;
  status: string;
  journal_transaction_id: string | null;
  created_at: string;
}

export function useInternalCharges(fiscalPeriodId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["internal_charges", fiscalPeriodId],
    queryFn: async () => {
      let q = (supabase as any)
        .from("internal_charges")
        .select("*, from_cc:from_cost_center_id(code, name), to_cc:to_cost_center_id(code, name)")
        .order("created_at", { ascending: false });
      if (fiscalPeriodId) q = q.eq("fiscal_period_id", fiscalPeriodId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as (InternalCharge & {
        from_cc: { code: string; name: string } | null;
        to_cc: { code: string; name: string } | null;
      })[];
    },
  });

  const create = useMutation({
    mutationFn: async (charge: Omit<InternalCharge, "id" | "created_at" | "journal_transaction_id">) => {
      const { data, error } = await (supabase as any).from("internal_charges").insert(charge).select().single();
      if (error) throw error;
      return data as InternalCharge;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["internal_charges"] }); toast.success("Internal charge created"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, journal_transaction_id }: { id: string; status: string; journal_transaction_id?: string }) => {
      const updates: any = { status };
      if (journal_transaction_id) updates.journal_transaction_id = journal_transaction_id;
      const { data, error } = await (supabase as any).from("internal_charges").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data as InternalCharge;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["internal_charges"] }); toast.success("Charge updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, create, updateStatus };
}
