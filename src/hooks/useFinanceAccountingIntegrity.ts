import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ensureSupabase, supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { FinanceAccountingIntegrity } from "@/types/financeAccounting";

export const useFinanceAccountingIntegrity = (
  ngoId?: string | null,
  startDate?: string,
  endDate?: string,
) =>
  useQuery({
    queryKey: ["finance-accounting-integrity", ngoId ?? "none", startDate, endDate],
    enabled: !!supabase && !!ngoId && !!startDate && !!endDate,
    queryFn: async (): Promise<FinanceAccountingIntegrity> => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("finance_accounting_integrity" as never, {
        _ngo_id: ngoId,
        _start_date: startDate,
        _end_date: endDate,
      } as never);
      if (error) throw error;
      return data as unknown as FinanceAccountingIntegrity;
    },
  });

export const useCaptureFinanceAccountingIntegrity = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ngoId, startDate, endDate }: { ngoId: string; startDate: string; endDate: string }) => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("capture_finance_accounting_integrity" as never, {
        _ngo_id: ngoId,
        _start_date: startDate,
        _end_date: endDate,
      } as never);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["finance-integrity-snapshots"] });
      toast.success("Accounting integrity snapshot captured");
    },
    onError: (error: Error) => toast.error(error.message),
  });
};
