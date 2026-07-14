import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { FinanceBankAccount, FinanceBankAccountInput } from "@/types/financeAccounting";

const ensureSupabase = () => {
  if (!supabase) throw getSupabaseNotConfiguredError();
};

export const useFinanceBankAccounts = (options?: { includeInactive?: boolean; ngoId?: string | null }) => {
  return useQuery({
    queryKey: ["finance-bank-accounts", options?.includeInactive ?? false, options?.ngoId ?? "all"],
    enabled: !!supabase,
    queryFn: async (): Promise<FinanceBankAccount[]> => {
      ensureSupabase();

      let query = supabase
        .from("finance_bank_accounts" as never)
        .select("*")
        .order("account_name", { ascending: true });

      if (!options?.includeInactive) {
        query = query.eq("is_active" as never, true as never);
      }
      if (options?.ngoId) {
        query = query.eq("ngo_id" as never, options.ngoId as never);
      }

      const { data: bankAccounts, error } = await query;
      if (error) throw error;
      if (!bankAccounts?.length) return [];

      const linkedIds = [...new Set(bankAccounts.map((b: FinanceBankAccount) => b.linked_finance_account_id))];

      const [{ data: glAccounts, error: glError }, ...balanceResults] = await Promise.all([
        supabase.from("finance_accounts" as never).select("id, code, name").in("id" as never, linkedIds as never),
        ...bankAccounts.map(async (bank: FinanceBankAccount) => {
          const { data, error: balError } = await supabase.rpc(
            "finance_bank_account_ledger_balance" as never,
            { _bank_account_id: bank.id } as never
          );
          if (balError) throw balError;
          return { id: bank.id, balance: Number(data) || 0 };
        }),
      ]);

      if (glError) throw glError;

      const glMap = new Map<string, { code: string; name: string }>();
      (glAccounts || []).forEach((a: { id: string; code: string; name: string }) => {
        glMap.set(a.id, { code: a.code, name: a.name });
      });

      const balanceMap = new Map<string, number>();
      balanceResults.forEach((result) => balanceMap.set(result.id, result.balance));

      return (bankAccounts as FinanceBankAccount[]).map((bank) => ({
        ...bank,
        opening_balance: Number(bank.opening_balance),
        ledger_balance: balanceMap.get(bank.id) ?? Number(bank.opening_balance),
        linked_account: glMap.get(bank.linked_finance_account_id) ?? null,
      }));
    },
  });
};

export const useCreateFinanceBankAccount = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: FinanceBankAccountInput) => {
      ensureSupabase();
      const { data, error } = await supabase
        .from("finance_bank_accounts" as never)
        .insert({
          ngo_id: input.ngo_id,
          account_kind: input.account_kind,
          account_name: input.account_name.trim(),
          institution_name: input.institution_name?.trim() || null,
          last_four: input.last_four?.trim() || null,
          linked_finance_account_id: input.linked_finance_account_id,
          opening_balance: input.opening_balance ?? 0,
          opening_balance_date: input.opening_balance_date ?? new Date().toISOString().slice(0, 10),
          is_active: input.is_active ?? true,
        } as never)
        .select()
        .single();
      if (error) throw error;
      return data as FinanceBankAccount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-bank-accounts"] });
      toast({ title: "Bank account created" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Could not create bank account", description: error.message });
    },
  });
};

export const useUpdateFinanceBankAccount = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<FinanceBankAccountInput> & { id: string }) => {
      ensureSupabase();
      const payload: Record<string, unknown> = {};
      if (input.ngo_id !== undefined) payload.ngo_id = input.ngo_id;
      if (input.account_kind !== undefined) payload.account_kind = input.account_kind;
      if (input.account_name !== undefined) payload.account_name = input.account_name.trim();
      if (input.institution_name !== undefined) payload.institution_name = input.institution_name?.trim() || null;
      if (input.last_four !== undefined) payload.last_four = input.last_four?.trim() || null;
      if (input.linked_finance_account_id !== undefined) payload.linked_finance_account_id = input.linked_finance_account_id;
      if (input.opening_balance !== undefined) payload.opening_balance = input.opening_balance;
      if (input.opening_balance_date !== undefined) payload.opening_balance_date = input.opening_balance_date;
      if (input.is_active !== undefined) payload.is_active = input.is_active;

      const { data, error } = await supabase
        .from("finance_bank_accounts" as never)
        .update(payload as never)
        .eq("id" as never, id as never)
        .select()
        .single();
      if (error) throw error;
      return data as FinanceBankAccount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-bank-accounts"] });
      toast({ title: "Bank account updated" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Could not update bank account", description: error.message });
    },
  });
};

export const useDeactivateFinanceBankAccount = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      ensureSupabase();
      const { data, error } = await supabase
        .from("finance_bank_accounts" as never)
        .update({ is_active: false } as never)
        .eq("id" as never, id as never)
        .select()
        .single();
      if (error) throw error;
      return data as FinanceBankAccount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-bank-accounts"] });
      toast({ title: "Bank account deactivated" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Could not deactivate bank account", description: error.message });
    },
  });
};
