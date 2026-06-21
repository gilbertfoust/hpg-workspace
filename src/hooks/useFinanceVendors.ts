import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { FinanceVendor, FinanceVendorInput } from "@/types/financeAccounting";

const ensureSupabase = () => {
  if (!supabase) throw getSupabaseNotConfiguredError();
};

export const useFinanceVendors = (options?: { includeInactive?: boolean }) => {
  return useQuery({
    queryKey: ["finance-vendors", options?.includeInactive ?? false],
    enabled: !!supabase,
    queryFn: async () => {
      ensureSupabase();
      let query = supabase.from("finance_vendors" as never).select("*").order("name", { ascending: true });
      if (!options?.includeInactive) {
        query = query.eq("is_active" as never, true as never);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as FinanceVendor[];
    },
  });
};

export const useCreateFinanceVendor = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: FinanceVendorInput) => {
      ensureSupabase();
      const { data, error } = await supabase
        .from("finance_vendors" as never)
        .insert({
          name: input.name.trim(),
          email: input.email?.trim() || null,
          phone: input.phone?.trim() || null,
          address: input.address?.trim() || null,
          tax_notes: input.tax_notes?.trim() || null,
          is_active: input.is_active ?? true,
        } as never)
        .select()
        .single();
      if (error) throw error;
      return data as FinanceVendor;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-vendors"] });
      toast({ title: "Vendor created" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Could not create vendor", description: error.message });
    },
  });
};

export const useUpdateFinanceVendor = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<FinanceVendorInput> & { id: string }) => {
      ensureSupabase();
      const payload: Record<string, unknown> = {};
      if (input.name !== undefined) payload.name = input.name.trim();
      if (input.email !== undefined) payload.email = input.email?.trim() || null;
      if (input.phone !== undefined) payload.phone = input.phone?.trim() || null;
      if (input.address !== undefined) payload.address = input.address?.trim() || null;
      if (input.tax_notes !== undefined) payload.tax_notes = input.tax_notes?.trim() || null;
      if (input.is_active !== undefined) payload.is_active = input.is_active;

      const { data, error } = await supabase
        .from("finance_vendors" as never)
        .update(payload as never)
        .eq("id" as never, id as never)
        .select()
        .single();
      if (error) throw error;
      return data as FinanceVendor;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-vendors"] });
      toast({ title: "Vendor updated" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Could not update vendor", description: error.message });
    },
  });
};

export const useDeactivateFinanceVendor = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      ensureSupabase();
      const { data, error } = await supabase
        .from("finance_vendors" as never)
        .update({ is_active: false } as never)
        .eq("id" as never, id as never)
        .select()
        .single();
      if (error) throw error;
      return data as FinanceVendor;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-vendors"] });
      toast({ title: "Vendor deactivated" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Could not deactivate vendor", description: error.message });
    },
  });
};
