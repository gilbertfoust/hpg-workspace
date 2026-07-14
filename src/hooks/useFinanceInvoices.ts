import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type {
  FinanceDonor,
  FinanceInvoice,
  FinanceInvoiceLine,
  FinanceInvoiceLineInput,
  FinanceInvoicePayment,
} from "@/types/financeAccounting";

const ensureSupabase = () => {
  if (!supabase) throw getSupabaseNotConfiguredError();
  return supabase;
};

const invalidateAr = (queryClient: ReturnType<typeof useQueryClient>) => {
  void queryClient.invalidateQueries({ queryKey: ["finance-invoices"] });
  void queryClient.invalidateQueries({ queryKey: ["finance-ar-aging"] });
  void queryClient.invalidateQueries({ queryKey: ["finance-ngo-accounts"] });
  void queryClient.invalidateQueries({ queryKey: ["finance-accounting-integrity"] });
  void queryClient.invalidateQueries({ queryKey: ["finance-reports"] });
};

export const useFinanceDonors = (ngoId?: string | null) =>
  useQuery({
    queryKey: ["finance-donors", ngoId ?? "all"],
    enabled: !!supabase,
    queryFn: async (): Promise<FinanceDonor[]> => {
      const client = ensureSupabase();
      let query = client.from("finance_donors" as never).select("*").order("name");
      if (ngoId) query = query.eq("ngo_id" as never, ngoId as never);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as FinanceDonor[];
    },
  });

export const useFinanceInvoices = (ngoId?: string | null) =>
  useQuery({
    queryKey: ["finance-invoices", ngoId ?? "all"],
    enabled: !!supabase && !!ngoId,
    queryFn: async (): Promise<FinanceInvoice[]> => {
      const client = ensureSupabase();
      let query = client.from("finance_invoices" as never).select("*").order("invoice_date", { ascending: false });
      if (ngoId) query = query.eq("ngo_id" as never, ngoId as never);
      const { data, error } = await query;
      if (error) throw error;
      if (!data?.length) return [];
      const ids = (data as FinanceInvoice[]).map((invoice) => invoice.id);
      const { data: lines, error: lineError } = await client
        .from("finance_invoice_lines" as never)
        .select("*")
        .in("invoice_id" as never, ids as never)
        .order("line_number");
      if (lineError) throw lineError;
      const byInvoice = new Map<string, FinanceInvoiceLine[]>();
      (lines || []).forEach((line: FinanceInvoiceLine) => {
        const invoiceLines = byInvoice.get(line.invoice_id) || [];
        invoiceLines.push({ ...line, amount: Number(line.amount) });
        byInvoice.set(line.invoice_id, invoiceLines);
      });
      return (data as FinanceInvoice[]).map((invoice) => ({
        ...invoice,
        subtotal: Number(invoice.subtotal),
        total: Number(invoice.total),
        amount_paid: Number(invoice.amount_paid),
        amount_written_off: Number(invoice.amount_written_off),
        lines: byInvoice.get(invoice.id) || [],
      }));
    },
  });

export const useFinanceArAging = (ngoId?: string | null) =>
  useQuery({
    queryKey: ["finance-ar-aging", ngoId ?? "all"],
    enabled: !!supabase && !!ngoId,
    queryFn: async () => {
      const client = ensureSupabase();
      let query = client
        .from("finance_invoices" as never)
        .select("invoice_number, customer_name, due_date, total, amount_paid, amount_written_off, status, ngo_id")
        .in("status" as never, ["sent", "partial"] as never);
      if (ngoId) query = query.eq("ngo_id" as never, ngoId as never);
      const { data, error } = await query;
      if (error) throw error;
      const today = new Date();
      return (data || []).map((raw) => {
        const invoice = raw as FinanceInvoice;
        const balance = Number(invoice.total) - Number(invoice.amount_paid) - Number(invoice.amount_written_off);
        const daysPastDue = invoice.due_date
          ? Math.floor((today.getTime() - new Date(invoice.due_date).getTime()) / 86400000)
          : 0;
        return {
          ...invoice,
          balance,
          bucket: daysPastDue <= 0 ? "current" : daysPastDue <= 30 ? "1-30" : daysPastDue <= 60 ? "31-60" : "61+",
        };
      });
    },
  });

export const useCreateFinanceDonor = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: Partial<FinanceDonor> & { name: string }) => {
      const client = ensureSupabase();
      const { data, error } = await client.from("finance_donors" as never).insert(input as never).select().single();
      if (error) throw error;
      return data as FinanceDonor;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-donors"] });
      toast({ title: "Donor created" });
    },
    onError: (error: Error) => toast({ variant: "destructive", title: "Error", description: error.message }),
  });
};

export const useSaveFinanceInvoice = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({
      id,
      header,
      lines,
    }: {
      id?: string;
      header: Partial<FinanceInvoice>;
      lines: FinanceInvoiceLineInput[];
    }) => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("save_finance_invoice" as never, {
        _invoice_id: id ?? null,
        _header: header,
        _lines: lines,
      } as never);
      if (error) throw error;
      return data as unknown as FinanceInvoice;
    },
    onSuccess: () => {
      invalidateAr(queryClient);
      toast({ title: "Invoice draft saved", description: "The draft is not in the ledger until it is issued." });
    },
    onError: (error: Error) => toast({ variant: "destructive", title: "Could not save invoice", description: error.message }),
  });
};

export const useIssueFinanceInvoice = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("issue_finance_invoice" as never, { _invoice_id: invoiceId } as never);
      if (error) throw error;
      return data as unknown as FinanceInvoice;
    },
    onSuccess: () => {
      invalidateAr(queryClient);
      toast({ title: "Invoice issued and posted", description: "Accounts Receivable and revenue were updated together." });
    },
    onError: (error: Error) => toast({ variant: "destructive", title: "Could not issue invoice", description: error.message }),
  });
};

export const useRecordFinanceInvoicePayment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({
      invoiceId,
      amount,
      paymentDate,
      bankAccountId,
      paymentMethod,
      memo,
      documentId,
    }: {
      invoiceId: string;
      amount: number;
      paymentDate: string;
      bankAccountId: string;
      paymentMethod?: string;
      memo?: string;
      documentId?: string | null;
    }) => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("record_finance_invoice_payment" as never, {
        _invoice_id: invoiceId,
        _payment_date: paymentDate,
        _amount: amount,
        _bank_account_id: bankAccountId,
        _payment_method: paymentMethod ?? null,
        _memo: memo ?? null,
        _document_id: documentId ?? null,
      } as never);
      if (error) throw error;
      return data as unknown as FinanceInvoicePayment;
    },
    onSuccess: () => {
      invalidateAr(queryClient);
      toast({ title: "Invoice receipt posted", description: "Cash and Accounts Receivable were updated together." });
    },
    onError: (error: Error) => toast({ variant: "destructive", title: "Could not post receipt", description: error.message }),
  });
};

export const useWriteOffFinanceInvoice = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ invoiceId, amount, reason }: { invoiceId: string; amount: number; reason: string }) => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("write_off_finance_invoice" as never, {
        _invoice_id: invoiceId,
        _amount: amount,
        _reason: reason,
      } as never);
      if (error) throw error;
      return data as unknown as FinanceInvoice;
    },
    onSuccess: () => {
      invalidateAr(queryClient);
      toast({ title: "Invoice write-off posted" });
    },
    onError: (error: Error) => toast({ variant: "destructive", title: "Could not write off invoice", description: error.message }),
  });
};

export const useVoidFinanceInvoice = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ invoiceId, reason }: { invoiceId: string; reason: string }) => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("void_finance_invoice" as never, {
        _invoice_id: invoiceId,
        _reason: reason,
      } as never);
      if (error) throw error;
      return data as unknown as FinanceInvoice;
    },
    onSuccess: () => {
      invalidateAr(queryClient);
      toast({ title: "Invoice voided with a reversing journal" });
    },
    onError: (error: Error) => toast({ variant: "destructive", title: "Could not void invoice", description: error.message }),
  });
};
