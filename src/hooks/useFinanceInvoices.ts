import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { FinanceDonor, FinanceInvoice } from "@/types/financeAccounting";

const ensureSupabase = () => {
  if (!supabase) throw getSupabaseNotConfiguredError();
};

export const useFinanceDonors = () =>
  useQuery({
    queryKey: ["finance-donors"],
    enabled: !!supabase,
    queryFn: async (): Promise<FinanceDonor[]> => {
      ensureSupabase();
      const { data, error } = await supabase.from("finance_donors" as never).select("*").order("name");
      if (error) throw error;
      return (data || []) as FinanceDonor[];
    },
  });

export const useFinanceInvoices = () =>
  useQuery({
    queryKey: ["finance-invoices"],
    enabled: !!supabase,
    queryFn: async (): Promise<FinanceInvoice[]> => {
      ensureSupabase();
      const { data, error } = await supabase
        .from("finance_invoices" as never)
        .select("*")
        .order("invoice_date", { ascending: false });
      if (error) throw error;
      return (data || []) as FinanceInvoice[];
    },
  });

export const useFinanceArAging = () =>
  useQuery({
    queryKey: ["finance-ar-aging"],
    enabled: !!supabase,
    queryFn: async () => {
      ensureSupabase();
      const { data, error } = await supabase
        .from("finance_invoices" as never)
        .select("invoice_number, customer_name, due_date, total, amount_paid, amount_written_off, status")
        .in("status" as never, ["sent", "partial"] as never);
      if (error) throw error;
      const today = new Date();
      return (data || []).map((inv: FinanceInvoice) => {
        const balance = Number(inv.total) - Number(inv.amount_paid) - Number(inv.amount_written_off);
        const daysPastDue = inv.due_date ? Math.floor((today.getTime() - new Date(inv.due_date).getTime()) / 86400000) : 0;
        return {
          ...inv,
          balance,
          bucket: daysPastDue <= 0 ? "current" : daysPastDue <= 30 ? "1-30" : daysPastDue <= 60 ? "31-60" : "61+",
        };
      });
    },
  });

export const useCreateFinanceDonor = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: Partial<FinanceDonor> & { name: string }) => {
      ensureSupabase();
      const { data, error } = await supabase.from("finance_donors" as never).insert(input as never).select().single();
      if (error) throw error;
      return data as FinanceDonor;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-donors"] });
      toast({ title: "Donor created" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });
};

export const useCreateFinanceInvoice = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: {
      invoice_number: string;
      donor_id?: string | null;
      customer_name?: string | null;
      invoice_date: string;
      due_date?: string | null;
      total: number;
      memo?: string | null;
    }) => {
      ensureSupabase();
      const { data, error } = await supabase
        .from("finance_invoices" as never)
        .insert({ ...input, subtotal: input.total, status: "sent" } as never)
        .select()
        .single();
      if (error) throw error;
      return data as FinanceInvoice;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-invoices"] });
      qc.invalidateQueries({ queryKey: ["finance-ar-aging"] });
      toast({ title: "Invoice created" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });
};

export const useRecordFinanceInvoicePayment = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ invoiceId, amount, paymentDate }: { invoiceId: string; amount: number; paymentDate: string }) => {
      ensureSupabase();
      const { data, error } = await supabase.rpc("record_finance_invoice_payment" as never, {
        _invoice_id: invoiceId,
        _payment_date: paymentDate,
        _amount: amount,
      } as never);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-invoices"] });
      qc.invalidateQueries({ queryKey: ["finance-ar-aging"] });
      toast({ title: "Payment recorded" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });
};
