import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Send, CheckCircle, Ban, Trash2, Eye, Pencil, Wallet } from "lucide-react";
import { FinancePaymentDialog } from "@/components/finance/accounting/FinancePaymentDialog";
import { useFinanceAccounts } from "@/hooks/useFinanceAccounts";
import { useFinanceBankAccounts } from "@/hooks/useFinanceBankAccounts";
import { useFinanceBills } from "@/hooks/useFinanceBills";
import { useFinanceFunds } from "@/hooks/useFinanceFunds";
import {
  useDeleteFinancePayment, useFinancePayments, usePostFinancePayment,
  useSaveFinancePayment, useSubmitFinancePayment, useVoidFinancePayment,
} from "@/hooks/useFinancePayments";
import type { FinancePayment, FinancePaymentInput } from "@/types/financeAccounting";
import { FINANCE_PAYMENT_STATUS_LABELS, FINANCE_PAYMENT_TYPE_LABELS } from "@/types/financeAccounting";
import { useQuery } from "@tanstack/react-query";
import { ensureSupabase } from "@/integrations/supabase/client";
import { useWorkspaceNgo } from "@/hooks/useWorkspaceNgo";

const fmt = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

const FinancePaymentsPage = () => {
  const { selectedNgo, selectedNgoId } = useWorkspaceNgo();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewPayment, setViewPayment] = useState<FinancePayment | null>(null);
  const [readOnly, setReadOnly] = useState(false);

  const { data: payments = [], isLoading, error } = useFinancePayments(undefined, selectedNgoId);
  const { data: bankAccounts = [] } = useFinanceBankAccounts();
  const { data: accounts = [] } = useFinanceAccounts();
  const { data: funds = [] } = useFinanceFunds();
  const { data: bills = [] } = useFinanceBills("all");

  const { data: refData } = useQuery({
    queryKey: ["finance-payment-ref"],
    queryFn: async () => {
      const supabase = ensureSupabase();
      const { data: grants } = await supabase.from("grant_applications").select("id, title").order("created_at", { ascending: false }).limit(100);
      return { grants: grants || [] };
    },
  });

  const savePayment = useSaveFinancePayment();
  const submitPayment = useSubmitFinancePayment();
  const postPayment = usePostFinancePayment();
  const voidPayment = useVoidFinancePayment();
  const deletePayment = useDeleteFinancePayment();

  const openBills = useMemo(() => bills.filter((b) => ["approved", "partially_paid"].includes(b.status) && (b.balance_due ?? 0) > 0), [bills]);
  const expenseAccounts = useMemo(() => accounts.filter((a) => a.account_type === "expense"), [accounts]);

  const openCreate = () => { setViewPayment(null); setReadOnly(false); setDialogOpen(true); };
  const openEdit = (p: FinancePayment) => { setViewPayment(p); setReadOnly(false); setDialogOpen(true); };
  const openView = (p: FinancePayment) => { setViewPayment(p); setReadOnly(true); setDialogOpen(true); };

  const handleSave = async (input: FinancePaymentInput) => {
    await savePayment.mutateAsync({ id: viewPayment?.id, input: { ...input, ngo_id: selectedNgoId } });
  };

  return (
    <MainLayout title="Payments & Disbursements" subtitle={`Reimbursements, pass-throughs, and transfers for ${selectedNgo?.common_name || selectedNgo?.legal_name || "All HPG"}`}>
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><Wallet className="h-4 w-4" />Finance payments</CardTitle>
            <CardDescription>Posting creates balanced journal entries with audit trail. Vendor bill payments link to AP bills.</CardDescription>
          </div>
          <Button onClick={openCreate} disabled={!selectedNgoId}><Plus className="h-4 w-4 mr-2" />New payment</Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : error ? (
            <p className="text-sm text-destructive text-center py-6">{(error as Error).message}</p>
          ) : payments.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">No payments yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-3">Number</th><th className="p-3">Type</th><th className="p-3">Date</th>
                    <th className="p-3">Amount</th><th className="p-3">NGO / Bill</th><th className="p-3">Status</th><th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b hover:bg-muted/40">
                      <td className="p-3 font-mono">{p.payment_number}</td>
                      <td className="p-3">{FINANCE_PAYMENT_TYPE_LABELS[p.payment_type]}</td>
                      <td className="p-3">{p.payment_date}</td>
                      <td className="p-3">{fmt(p.amount)}</td>
                      <td className="p-3 text-muted-foreground">{p.ngo?.common_name || p.ngo?.legal_name || p.bill?.bill_number || "—"}</td>
                      <td className="p-3"><Badge variant={p.status === "posted" ? "default" : "secondary"}>{FINANCE_PAYMENT_STATUS_LABELS[p.status]}</Badge></td>
                      <td className="p-3 text-right space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => openView(p)}><Eye className="h-3 w-3" /></Button>
                        {p.status === "draft" && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => openEdit(p)}><Pencil className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => submitPayment.mutate(p.id)}><Send className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => postPayment.mutate(p.id)}><CheckCircle className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deletePayment.mutate(p.id)}><Trash2 className="h-3 w-3" /></Button>
                          </>
                        )}
                        {p.status === "pending_approval" && (
                          <Button variant="ghost" size="sm" onClick={() => postPayment.mutate(p.id)}><CheckCircle className="h-3 w-3 mr-1" />Post</Button>
                        )}
                        {p.status === "posted" && (
                          <Button variant="ghost" size="sm" onClick={() => voidPayment.mutate({ id: p.id })}><Ban className="h-3 w-3" /></Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <FinancePaymentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        payment={viewPayment}
        readOnly={readOnly}
        bankAccounts={bankAccounts}
        expenseAccounts={expenseAccounts}
        funds={funds}
        ngoId={selectedNgoId}
        ngoName={selectedNgo?.common_name || selectedNgo?.legal_name || "All HPG"}
        openBills={openBills}
        grants={refData?.grants ?? []}
        onSave={handleSave}
        isSaving={savePayment.isPending}
      />
    </MainLayout>
  );
};

export default FinancePaymentsPage;
