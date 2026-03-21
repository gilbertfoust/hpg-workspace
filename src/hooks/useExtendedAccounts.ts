import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ExtendedAccount {
  id: string;
  ngo_id: string | null;
  parent_account_id: string | null;
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "income" | "expense";
  is_active: boolean;
  account_description: string | null;
  normal_balance: "debit" | "credit";
  financial_statement_type: "balance_sheet" | "income_statement" | "cash_flow_support";
  balance_sheet_section: string | null;
  income_statement_section: string | null;
  cash_flow_section: string | null;
  is_contra_account: boolean;
  created_at: string;
  updated_at: string;
}

export function useExtendedAccounts(ngoId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["extended_accounts", ngoId],
    queryFn: async () => {
      let q = (supabase as any).from("accounts").select("*").eq("is_active", true).order("code");
      if (ngoId) {
        q = q.or(`ngo_id.is.null,ngo_id.eq.${ngoId}`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as ExtendedAccount[];
    },
  });

  const updateAccount = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ExtendedAccount> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from("accounts")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as ExtendedAccount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["extended_accounts"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });

  return { ...query, updateAccount };
}

/** Get the balance for an account based on its normal balance direction */
export function getAccountBalance(
  normalBalance: "debit" | "credit",
  totalDebit: number,
  totalCredit: number
): number {
  return normalBalance === "debit"
    ? totalDebit - totalCredit
    : totalCredit - totalDebit;
}

/** Default normal balance for an account type */
export function defaultNormalBalance(type: string): "debit" | "credit" {
  switch (type) {
    case "asset":
    case "expense":
      return "debit";
    case "liability":
    case "equity":
    case "income":
      return "credit";
    default:
      return "debit";
  }
}
