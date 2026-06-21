import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type {
  FinanceBill,
  FinanceBillInput,
  FinanceBillLine,
  FinanceBillLineInput,
  FinanceBillPayment,
  FinanceBillStatus,
} from "@/types/financeAccounting";

const ensureSupabase = () => {
  if (!supabase) throw getSupabaseNotConfiguredError();
};

const normalizeBillLines = (lines: FinanceBillLineInput[]): FinanceBillLineInput[] =>
  lines
    .filter((line) => line.expense_account_id && line.amount > 0)
    .map((line, index) => ({
      ...line,
      amount: Number(line.amount) || 0,
      line_number: index + 1,
    }));

const enrichBills = (
  bills: FinanceBill[],
  vendors: { id: string; name: string }[],
  linesByBill: Map<string, FinanceBillLine[]>
): FinanceBill[] => {
  const vendorMap = new Map(vendors.map((v) => [v.id, v]));
  return bills.map((bill) => ({
    ...bill,
    total_amount: Number(bill.total_amount),
    amount_paid: Number(bill.amount_paid),
    balance_due: Math.round((Number(bill.total_amount) - Number(bill.amount_paid)) * 100) / 100,
    vendor: vendorMap.get(bill.vendor_id) ?? null,
    lines: linesByBill.get(bill.id) || [],
  }));
};

export const useFinanceBills = (statusFilter?: FinanceBillStatus | "all") => {
  return useQuery({
    queryKey: ["finance-bills", statusFilter ?? "all"],
    enabled: !!supabase,
    queryFn: async (): Promise<FinanceBill[]> => {
      ensureSupabase();

      let query = supabase
        .from("finance_bills" as never)
        .select("*")
        .order("bill_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status" as never, statusFilter as never);
      }

      const { data: bills, error } = await query;
      if (error) throw error;
      if (!bills?.length) return [];

      const billIds = bills.map((b: FinanceBill) => b.id);
      const vendorIds = [...new Set(bills.map((b: FinanceBill) => b.vendor_id))];

      const [{ data: vendors, error: vendorError }, { data: lines, error: lineError }] = await Promise.all([
        supabase.from("finance_vendors" as never).select("id, name").in("id" as never, vendorIds as never),
        supabase
          .from("finance_bill_lines" as never)
          .select("*")
          .in("bill_id" as never, billIds as never)
          .order("line_number", { ascending: true }),
      ]);

      if (vendorError) throw vendorError;
      if (lineError) throw lineError;

      const linesByBill = new Map<string, FinanceBillLine[]>();
      (lines || []).forEach((line: FinanceBillLine) => {
        const bucket = linesByBill.get(line.bill_id) || [];
        bucket.push({ ...line, amount: Number(line.amount) });
        linesByBill.set(line.bill_id, bucket);
      });

      return enrichBills(bills as FinanceBill[], (vendors || []) as { id: string; name: string }[], linesByBill);
    },
  });
};

export const useSaveFinanceBill = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: FinanceBillInput }) => {
      ensureSupabase();
      const lines = normalizeBillLines(input.lines);

      if (id) {
        const { data: existing, error: fetchError } = await supabase
          .from("finance_bills" as never)
          .select("status")
          .eq("id" as never, id as never)
          .single();
        if (fetchError) throw fetchError;
        if (!["draft", "pending_approval"].includes((existing as { status: string }).status)) {
          throw new Error("Only draft or pending approval bills can be edited.");
        }

        const { data: bill, error: updateError } = await supabase
          .from("finance_bills" as never)
          .update({
            vendor_id: input.vendor_id,
            bill_date: input.bill_date,
            due_date: input.due_date || null,
            terms: input.terms?.trim() || null,
            memo: input.memo?.trim() || null,
            document_id: input.document_id || null,
          } as never)
          .eq("id" as never, id as never)
          .select()
          .single();
        if (updateError) throw updateError;

        await supabase.from("finance_bill_lines" as never).delete().eq("bill_id" as never, id as never);

        if (lines.length > 0) {
          const { error: linesError } = await supabase.from("finance_bill_lines" as never).insert(
            lines.map((line) => ({
              bill_id: id,
              expense_account_id: line.expense_account_id,
              amount: line.amount,
              memo: line.memo?.trim() || null,
              fund_id: line.fund_id || null,
              ngo_id: line.ngo_id || null,
              department_id: line.department_id || null,
              dimension_id: line.dimension_id || null,
              grant_application_id: line.grant_application_id || null,
              line_number: line.line_number,
            })) as never
          );
          if (linesError) throw linesError;
        }

        return bill as FinanceBill;
      }

      const { data: bill, error: insertError } = await supabase
        .from("finance_bills" as never)
        .insert({
          vendor_id: input.vendor_id,
          bill_date: input.bill_date,
          due_date: input.due_date || null,
          terms: input.terms?.trim() || null,
          memo: input.memo?.trim() || null,
          document_id: input.document_id || null,
          status: "draft",
          created_by_user_id: user?.id ?? null,
          bill_number: "",
        } as never)
        .select()
        .single();
      if (insertError) throw insertError;

      const billId = (bill as FinanceBill).id;

      if (lines.length > 0) {
        const { error: linesError } = await supabase.from("finance_bill_lines" as never).insert(
          lines.map((line) => ({
            bill_id: billId,
            expense_account_id: line.expense_account_id,
            amount: line.amount,
            memo: line.memo?.trim() || null,
            fund_id: line.fund_id || null,
            ngo_id: line.ngo_id || null,
            department_id: line.department_id || null,
            dimension_id: line.dimension_id || null,
            grant_application_id: line.grant_application_id || null,
            line_number: line.line_number,
          })) as never
        );
        if (linesError) throw linesError;
      }

      return bill as FinanceBill;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-bills"] });
      toast({ title: "Bill saved" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Could not save bill", description: error.message });
    },
  });
};

export const useSubmitFinanceBillForApproval = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (billId: string) => {
      ensureSupabase();
      const { data, error } = await supabase
        .from("finance_bills" as never)
        .update({ status: "pending_approval" } as never)
        .eq("id" as never, billId as never)
        .eq("status" as never, "draft" as never)
        .select()
        .single();
      if (error) throw error;
      return data as FinanceBill;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-bills"] });
      toast({ title: "Bill submitted for approval" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Could not submit bill", description: error.message });
    },
  });
};

export const useApproveFinanceBill = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (billId: string) => {
      ensureSupabase();
      const { data, error } = await supabase.rpc("approve_finance_bill" as never, { _bill_id: billId } as never);
      if (error) throw error;
      return data as FinanceBill;
    },
    onSuccess: (bill) => {
      queryClient.invalidateQueries({ queryKey: ["finance-bills"] });
      queryClient.invalidateQueries({ queryKey: ["finance-journal-entries"] });
      toast({ title: "Bill approved", description: `${bill.bill_number} posted to the ledger.` });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Could not approve bill", description: error.message });
    },
  });
};

export const usePayFinanceBill = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      billId,
      amount,
      bankAccountId,
      paymentDate,
      memo,
    }: {
      billId: string;
      amount: number;
      bankAccountId: string;
      paymentDate: string;
      memo?: string;
    }) => {
      ensureSupabase();
      const { data, error } = await supabase.rpc("pay_finance_bill" as never, {
        _bill_id: billId,
        _amount: amount,
        _bank_account_id: bankAccountId,
        _payment_date: paymentDate,
        _memo: memo ?? null,
      } as never);
      if (error) throw error;
      return data as FinanceBillPayment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-bills"] });
      queryClient.invalidateQueries({ queryKey: ["finance-journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["finance-bank-accounts"] });
      toast({ title: "Payment recorded" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Could not record payment", description: error.message });
    },
  });
};

export const useVoidFinanceBill = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ billId, reason }: { billId: string; reason?: string }) => {
      ensureSupabase();
      const { data, error } = await supabase.rpc("void_finance_bill" as never, {
        _bill_id: billId,
        _reason: reason ?? null,
      } as never);
      if (error) throw error;
      return data as FinanceBill;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-bills"] });
      toast({ title: "Bill voided" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Could not void bill", description: error.message });
    },
  });
};

export const useDeleteFinanceBill = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (billId: string) => {
      ensureSupabase();
      const { error } = await supabase.from("finance_bills" as never).delete().eq("id" as never, billId as never);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-bills"] });
      toast({ title: "Draft bill deleted" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Could not delete bill", description: error.message });
    },
  });
};

export const useFinanceBillReferenceData = () => {
  return useQuery({
    queryKey: ["finance-bill-reference-data"],
    enabled: !!supabase,
    queryFn: async () => {
      ensureSupabase();
      const [{ data: ngos }, { data: departments }, { data: documents }] = await Promise.all([
        supabase.from("ngos").select("id, legal_name, common_name").order("legal_name").limit(200),
        supabase.from("org_units").select("id, department_name").order("department_name"),
        supabase.from("documents").select("id, file_name").order("created_at", { ascending: false }).limit(100),
      ]);
      return { ngos: ngos || [], departments: departments || [], documents: documents || [] };
    },
  });
};
