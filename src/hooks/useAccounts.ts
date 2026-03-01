import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Account {
  id: string;
  ngo_id: string | null;
  parent_account_id: string | null;
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "income" | "expense";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useAccounts(ngoId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["accounts", ngoId],
    queryFn: async () => {
      let q = (supabase as any).from("accounts").select("*").eq("is_active", true).order("code");
      if (ngoId) {
        q = q.or(`ngo_id.is.null,ngo_id.eq.${ngoId}`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Account[];
    },
  });

  const create = useMutation({
    mutationFn: async (account: Omit<Account, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await (supabase as any).from("accounts").insert(account).select().single();
      if (error) throw error;
      return data as Account;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accounts"] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Account> & { id: string }) => {
      const { data, error } = await (supabase as any).from("accounts").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data as Account;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accounts"] }),
  });

  return { ...query, create, update };
}
