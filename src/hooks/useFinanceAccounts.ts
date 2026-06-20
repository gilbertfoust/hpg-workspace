import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { FinanceAccount, FinanceAccountInput } from "@/types/financeAccounting";
import { STARTER_FINANCE_ACCOUNTS } from "@/types/financeAccounting";

const ensureSupabase = () => {
  if (!supabase) throw getSupabaseNotConfiguredError();
};

export const useFinanceAccounts = (options?: { includeInactive?: boolean }) => {
  return useQuery({
    queryKey: ["finance-accounts", options?.includeInactive ?? false],
    enabled: !!supabase,
    queryFn: async () => {
      ensureSupabase();
      let query = supabase.from("finance_accounts" as never).select("*").order("code", { ascending: true });
      if (!options?.includeInactive) {
        query = query.eq("is_active" as never, true as never);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as FinanceAccount[];
    },
  });
};

export const useFinanceAccountUsage = (accountIds: string[]) => {
  return useQuery({
    queryKey: ["finance-account-usage", accountIds],
    enabled: !!supabase && accountIds.length > 0,
    queryFn: async () => {
      ensureSupabase();

      const { data: postedEntries, error: entryError } = await supabase
        .from("finance_journal_entries" as never)
        .select("id")
        .eq("status" as never, "posted" as never);

      if (entryError) throw entryError;
      const entryIds = (postedEntries || []).map((row: { id: string }) => row.id);
      if (entryIds.length === 0) return new Set<string>();

      const { data: lines, error: lineError } = await supabase
        .from("finance_journal_lines" as never)
        .select("account_id")
        .in("journal_entry_id" as never, entryIds as never)
        .in("account_id" as never, accountIds as never);

      if (lineError) throw lineError;

      const posted = new Set<string>();
      (lines || []).forEach((row: { account_id: string }) => posted.add(row.account_id));
      return posted;
    },
  });
};

export const useCreateFinanceAccount = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: FinanceAccountInput) => {
      ensureSupabase();
      const { data, error } = await supabase
        .from("finance_accounts" as never)
        .insert(input as never)
        .select()
        .single();
      if (error) throw error;
      return data as FinanceAccount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-accounts"] });
      toast({ title: "Account created" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Could not create account", description: error.message });
    },
  });
};

export const useUpdateFinanceAccount = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<FinanceAccountInput> & { id: string }) => {
      ensureSupabase();
      const { data, error } = await supabase
        .from("finance_accounts" as never)
        .update(input as never)
        .eq("id" as never, id as never)
        .select()
        .single();
      if (error) throw error;
      return data as FinanceAccount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-accounts"] });
      toast({ title: "Account updated" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Could not update account", description: error.message });
    },
  });
};

export const useDeactivateFinanceAccount = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      ensureSupabase();
      const { data, error } = await supabase
        .from("finance_accounts" as never)
        .update({ is_active: false } as never)
        .eq("id" as never, id as never)
        .select()
        .single();
      if (error) throw error;
      return data as FinanceAccount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-accounts"] });
      toast({ title: "Account deactivated", description: "Accounts with posted activity cannot be deleted; deactivation hides them from new entries." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Could not deactivate account", description: error.message });
    },
  });
};

export const useSeedStarterFinanceAccounts = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      ensureSupabase();
      const { count, error: countError } = await supabase
        .from("finance_accounts" as never)
        .select("id", { count: "exact", head: true });

      if (countError) throw countError;
      if ((count ?? 0) > 0) {
        throw new Error("Chart of accounts already has records. Starter seed is only for empty ledgers.");
      }

      const { data, error } = await supabase
        .from("finance_accounts" as never)
        .insert(STARTER_FINANCE_ACCOUNTS as never)
        .select();

      if (error) throw error;
      return (data || []) as FinanceAccount[];
    },
    onSuccess: (accounts) => {
      queryClient.invalidateQueries({ queryKey: ["finance-accounts"] });
      toast({
        title: "Starter chart loaded",
        description: `Added ${accounts.length} demo nonprofit accounts (clearly labeled starter seed).`,
      });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Could not load starter chart", description: error.message });
    },
  });
};
