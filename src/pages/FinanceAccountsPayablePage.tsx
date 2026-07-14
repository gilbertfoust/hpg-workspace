import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Plus,
  FileText,
  Users,
  CheckCircle,
  Send,
  CreditCard,
  Ban,
  Pencil,
  Eye,
  Trash2,
} from "lucide-react";
import { FinanceVendorDialog } from "@/components/finance/accounting/FinanceVendorDialog";
import { FinanceBillDialog } from "@/components/finance/accounting/FinanceBillDialog";
import { FinanceBillPaymentDialog } from "@/components/finance/accounting/FinanceBillPaymentDialog";
import { useFinanceAccounts } from "@/hooks/useFinanceAccounts";
import { useFinanceFunds } from "@/hooks/useFinanceFunds";
import { useFinanceBankAccounts } from "@/hooks/useFinanceBankAccounts";
import {
  useApproveFinanceBill,
  useDeleteFinanceBill,
  useFinanceBillReferenceData,
  useFinanceBills,
  usePayFinanceBill,
  useSaveFinanceBill,
  useSubmitFinanceBillForApproval,
  useVoidFinanceBill,
} from "@/hooks/useFinanceBills";
import {
  useCreateFinanceVendor,
  useDeactivateFinanceVendor,
  useFinanceVendors,
  useUpdateFinanceVendor,
} from "@/hooks/useFinanceVendors";
import type {
  FinanceBill,
  FinanceBillInput,
  FinanceBillStatus,
  FinanceVendor,
  FinanceVendorInput,
} from "@/types/financeAccounting";
import { FINANCE_BILL_STATUS_LABELS } from "@/types/financeAccounting";
import { useWorkspaceNgo } from "@/hooks/useWorkspaceNgo";

const formatMoney = (value: number) =>
  value.toLocaleString(undefined, { style: "currency", currency: "USD" });

const billStatusVariant = (status: FinanceBillStatus): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "paid":
      return "default";
    case "approved":
    case "partially_paid":
      return "outline";
    case "voided":
      return "destructive";
    default:
      return "secondary";
  }
};

const FinanceAccountsPayablePage = () => {
  const { selectedNgo, selectedNgoId } = useWorkspaceNgo();
  const [billStatusFilter, setBillStatusFilter] = useState<string>("all");
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<FinanceVendor | null>(null);
  const [billDialogOpen, setBillDialogOpen] = useState(false);
  const [viewBill, setViewBill] = useState<FinanceBill | null>(null);
  const [readOnlyBill, setReadOnlyBill] = useState(false);
  const [payBill, setPayBill] = useState<FinanceBill | null>(null);

  const { data: vendors = [], isLoading: vendorsLoading, error: vendorsError } = useFinanceVendors({ includeInactive: true });
  const { data: bills = [], isLoading: billsLoading, error: billsError } = useFinanceBills(
    billStatusFilter === "all" ? "all" : (billStatusFilter as FinanceBillStatus),
    selectedNgoId,
  );
  const { data: accounts = [] } = useFinanceAccounts();
  const { data: funds = [] } = useFinanceFunds();
  const { data: bankAccounts = [] } = useFinanceBankAccounts({ ngoId: selectedNgoId });
  const { data: referenceData } = useFinanceBillReferenceData();

  const createVendor = useCreateFinanceVendor();
  const updateVendor = useUpdateFinanceVendor();
  const deactivateVendor = useDeactivateFinanceVendor();
  const saveBill = useSaveFinanceBill();
  const submitBill = useSubmitFinanceBillForApproval();
  const approveBill = useApproveFinanceBill();
  const payBillMutation = usePayFinanceBill();
  const voidBill = useVoidFinanceBill();
  const deleteBill = useDeleteFinanceBill();

  const expenseAccounts = useMemo(
    () => accounts.filter((a) => a.account_type === "expense" || a.account_type === "asset"),
    [accounts]
  );

  const apSummary = useMemo(() => {
    const open = bills.filter((b) => ["approved", "partially_paid"].includes(b.status));
    const due = open.reduce((sum, b) => sum + (b.balance_due ?? 0), 0);
    return { openCount: open.length, totalDue: due };
  }, [bills]);

  const handleVendorSave = async (input: FinanceVendorInput) => {
    if (editingVendor) {
      await updateVendor.mutateAsync({ id: editingVendor.id, ...input });
    } else {
      await createVendor.mutateAsync(input);
    }
  };

  const openCreateBill = () => {
    setViewBill(null);
    setReadOnlyBill(false);
    setBillDialogOpen(true);
  };

  const openEditBill = (bill: FinanceBill) => {
    setViewBill(bill);
    setReadOnlyBill(false);
    setBillDialogOpen(true);
  };

  const openViewBill = (bill: FinanceBill) => {
    setViewBill(bill);
    setReadOnlyBill(true);
    setBillDialogOpen(true);
  };

  const handleBillSave = async (input: FinanceBillInput) => {
    await saveBill.mutateAsync({ id: viewBill?.id, input: { ...input, ngo_id: selectedNgoId } });
  };

  const handlePay = async (input: { amount: number; bankAccountId: string; paymentDate: string; memo?: string }) => {
    if (!payBill) return;
    await payBillMutation.mutateAsync({
      billId: payBill.id,
      amount: input.amount,
      bankAccountId: input.bankAccountId,
      paymentDate: input.paymentDate,
      memo: input.memo,
    });
  };

  return (
    <MainLayout
      title="Accounts Payable"
      subtitle={`Vendors, bills, approvals, and payments for ${selectedNgo?.common_name || selectedNgo?.legal_name || "All HPG"}`}
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Open bills</CardDescription>
              <CardTitle className="text-2xl">{apSummary.openCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total balance due</CardDescription>
              <CardTitle className="text-2xl">{formatMoney(apSummary.totalDue)}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Tabs defaultValue="bills">
          <TabsList>
            <TabsTrigger value="bills" className="gap-2">
              <FileText className="h-4 w-4" />
              Bills
            </TabsTrigger>
            <TabsTrigger value="vendors" className="gap-2">
              <Users className="h-4 w-4" />
              Vendors
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bills" className="mt-4">
            <Card>
              <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle className="text-base">Vendor bills</CardTitle>
                  <CardDescription>
                    Draft → submit for approval → approve (debits expense, credits AP) → pay (debits AP, credits bank).
                  </CardDescription>
                </div>
                <Button onClick={openCreateBill} disabled={!selectedNgoId || vendors.filter((v) => v.is_active).length === 0}>
                  <Plus className="h-4 w-4 mr-2" />
                  New bill
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Status filter</Label>
                  <Select value={billStatusFilter} onValueChange={setBillStatusFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      {(Object.keys(FINANCE_BILL_STATUS_LABELS) as FinanceBillStatus[]).map((status) => (
                        <SelectItem key={status} value={status}>
                          {FINANCE_BILL_STATUS_LABELS[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {billsLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : billsError ? (
                  <p className="text-sm text-destructive py-6 text-center">
                    {(billsError as Error).message.includes("does not exist")
                      ? "AP tables are not applied yet. Run the Phase 36 migration locally."
                      : (billsError as Error).message}
                  </p>
                ) : bills.length === 0 ? (
                  <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                    No bills yet. Add a vendor first, then create a bill with expense lines.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="p-3">Bill #</th>
                          <th className="p-3">Vendor</th>
                          <th className="p-3">Date</th>
                          <th className="p-3">Due</th>
                          <th className="p-3">Total</th>
                          <th className="p-3">Balance</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bills.map((bill) => (
                          <tr key={bill.id} className="border-b hover:bg-muted/40">
                            <td className="p-3 font-mono">{bill.bill_number}</td>
                            <td className="p-3">{bill.vendor?.name || "—"}</td>
                            <td className="p-3">{bill.bill_date}</td>
                            <td className="p-3">{bill.due_date || "—"}</td>
                            <td className="p-3">{formatMoney(bill.total_amount)}</td>
                            <td className="p-3">{formatMoney(bill.balance_due ?? 0)}</td>
                            <td className="p-3">
                              <Badge variant={billStatusVariant(bill.status)}>
                                {FINANCE_BILL_STATUS_LABELS[bill.status]}
                              </Badge>
                            </td>
                            <td className="p-3">
                              <div className="flex justify-end flex-wrap gap-1">
                                <Button variant="ghost" size="sm" onClick={() => openViewBill(bill)}>
                                  <Eye className="h-3 w-3 mr-1" />
                                  View
                                </Button>
                                {bill.status === "draft" && (
                                  <>
                                    <Button variant="ghost" size="sm" onClick={() => openEditBill(bill)}>
                                      <Pencil className="h-3 w-3 mr-1" />
                                      Edit
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => submitBill.mutate(bill.id)}
                                      disabled={submitBill.isPending || bill.total_amount <= 0}
                                    >
                                      <Send className="h-3 w-3 mr-1" />
                                      Submit
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => approveBill.mutate(bill.id)}
                                      disabled={approveBill.isPending || bill.total_amount <= 0}
                                    >
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Approve
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-destructive"
                                      onClick={() => deleteBill.mutate(bill.id)}
                                    >
                                      <Trash2 className="h-3 w-3 mr-1" />
                                      Delete
                                    </Button>
                                  </>
                                )}
                                {bill.status === "pending_approval" && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => approveBill.mutate(bill.id)}
                                      disabled={approveBill.isPending}
                                    >
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Approve
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => voidBill.mutate({ billId: bill.id })}
                                    >
                                      <Ban className="h-3 w-3 mr-1" />
                                      Void
                                    </Button>
                                  </>
                                )}
                                {(bill.status === "approved" || bill.status === "partially_paid") &&
                                  (bill.balance_due ?? 0) > 0 && (
                                    <Button variant="ghost" size="sm" onClick={() => setPayBill(bill)}>
                                      <CreditCard className="h-3 w-3 mr-1" />
                                      Pay
                                    </Button>
                                  )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vendors" className="mt-4">
            <Card>
              <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle className="text-base">Vendors</CardTitle>
                  <CardDescription>Supplier records for accounts payable bills.</CardDescription>
                </div>
                <Button
                  onClick={() => {
                    setEditingVendor(null);
                    setVendorDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add vendor
                </Button>
              </CardHeader>
              <CardContent>
                {vendorsLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : vendorsError ? (
                  <p className="text-sm text-destructive py-6 text-center">{(vendorsError as Error).message}</p>
                ) : vendors.length === 0 ? (
                  <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                    No vendors yet. Add your first vendor to begin entering bills.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="p-3">Name</th>
                          <th className="p-3">Email</th>
                          <th className="p-3">Phone</th>
                          <th className="p-3">Tax notes</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vendors.map((vendor) => (
                          <tr key={vendor.id} className="border-b hover:bg-muted/40">
                            <td className="p-3 font-medium">{vendor.name}</td>
                            <td className="p-3 text-muted-foreground">{vendor.email || "—"}</td>
                            <td className="p-3 text-muted-foreground">{vendor.phone || "—"}</td>
                            <td className="p-3 text-muted-foreground max-w-xs truncate">{vendor.tax_notes || "—"}</td>
                            <td className="p-3">
                              <Badge variant={vendor.is_active ? "default" : "secondary"}>
                                {vendor.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </td>
                            <td className="p-3 text-right space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingVendor(vendor);
                                  setVendorDialogOpen(true);
                                }}
                              >
                                Edit
                              </Button>
                              {vendor.is_active && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive"
                                  onClick={() => deactivateVendor.mutate(vendor.id)}
                                >
                                  Deactivate
                                </Button>
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
          </TabsContent>
        </Tabs>
      </div>

      <FinanceVendorDialog
        open={vendorDialogOpen}
        onOpenChange={setVendorDialogOpen}
        vendor={editingVendor}
        onSave={handleVendorSave}
        isSaving={createVendor.isPending || updateVendor.isPending}
      />

      <FinanceBillDialog
        open={billDialogOpen}
        onOpenChange={setBillDialogOpen}
        bill={viewBill}
        readOnly={readOnlyBill}
        vendors={vendors.filter((v) => v.is_active)}
        expenseAccounts={expenseAccounts}
        funds={funds}
        ngoId={selectedNgoId}
        ngoName={selectedNgo?.common_name || selectedNgo?.legal_name || "All HPG"}
        referenceData={referenceData}
        onSave={handleBillSave}
        isSaving={saveBill.isPending}
      />

      <FinanceBillPaymentDialog
        open={!!payBill}
        onOpenChange={(open) => !open && setPayBill(null)}
        bill={payBill}
        bankAccounts={bankAccounts}
        onPay={handlePay}
        isPaying={payBillMutation.isPending}
      />
    </MainLayout>
  );
};

export default FinanceAccountsPayablePage;
