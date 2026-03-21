import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNGOs } from "@/hooks/useNGOs";
import { useBills } from "@/hooks/useBills";
import { useExtendedAccounts } from "@/hooks/useExtendedAccounts";
import { useTransactions } from "@/hooks/useTransactions";
import { format } from "date-fns";

function fmt(n: number) { return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export default function BillsPage() {
  const { toast } = useToast();
  const { data: ngos } = useNGOs();
  const [selectedNgoId, setSelectedNgoId] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const { data: bills, create: createBill, update: updateBill } = useBills(selectedNgoId || undefined);
  const { data: accounts } = useExtendedAccounts(selectedNgoId || undefined);
  const { create: createTransaction } = useTransactions(selectedNgoId || undefined);

  const [billNumber, setBillNumber] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [total, setTotal] = useState(0);
  const [notes, setNotes] = useState("");
  const [apAccountId, setApAccountId] = useState("");
  const [expenseAccountId, setExpenseAccountId] = useState("");

  const liabilityAccounts = accounts?.filter(a => a.type === "liability") || [];
  const expenseAccounts = accounts?.filter(a => a.type === "expense") || [];

  const resetForm = () => {
    setBillNumber(""); setVendorName(""); setDueDate("");
    setTotal(0); setNotes(""); setApAccountId(""); setExpenseAccountId("");
  };

  const handleCreate = async () => {
    if (!selectedNgoId || !billNumber || !vendorName || !dueDate || total <= 0) return;
    try {
      // Create bill
      const bill = await createBill.mutateAsync({
        ngo_id: selectedNgoId,
        bill_number: billNumber,
        vendor_name: vendorName,
        due_date: dueDate,
        subtotal: total,
        total,
        ap_account_id: apAccountId || undefined,
        notes: notes || undefined,
      });

      // Auto-post journal entry: DR Expense, CR AP
      if (apAccountId && expenseAccountId) {
        const txn = await createTransaction.mutateAsync({
          transaction: {
            ngo_id: selectedNgoId,
            transaction_date: format(new Date(), "yyyy-MM-dd"),
            description: `Bill #${billNumber} - ${vendorName}`,
            reference_number: `BILL-${billNumber}`,
            fiscal_period_id: null,
            created_by_user_id: null,
          },
          entries: [
            { account_id: expenseAccountId, debit: total, credit: 0, memo: "Expense from bill" },
            { account_id: apAccountId, debit: 0, credit: total, memo: "AP recorded" },
          ],
        });
        await updateBill.mutateAsync({ id: bill.id, transaction_id: txn.id });
      }

      toast({ title: "Bill created" });
      resetForm();
      setShowCreate(false);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleRecordPayment = async (bill: any) => {
    try {
      const cashAccount = accounts?.find(a => a.name.toLowerCase().includes("cash") && a.type === "asset");
      const apId = bill.ap_account_id || apAccountId;
      if (!cashAccount || !apId) {
        toast({ variant: "destructive", title: "Need cash and AP accounts configured" });
        return;
      }
      const txn = await createTransaction.mutateAsync({
        transaction: {
          ngo_id: bill.ngo_id,
          transaction_date: format(new Date(), "yyyy-MM-dd"),
          description: `Payment: Bill #${bill.bill_number} - ${bill.vendor_name}`,
          reference_number: `PMT-BILL-${bill.bill_number}`,
          fiscal_period_id: bill.fiscal_period_id,
          created_by_user_id: null,
        },
        entries: [
          { account_id: apId, debit: Number(bill.total), credit: 0, memo: "AP cleared" },
          { account_id: cashAccount.id, debit: 0, credit: Number(bill.total), memo: "Cash paid" },
        ],
      });
      await updateBill.mutateAsync({
        id: bill.id,
        status: "paid",
        paid_date: format(new Date(), "yyyy-MM-dd"),
        payment_transaction_id: txn.id,
      });
      toast({ title: "Payment recorded and journal entry created" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const summary = useMemo(() => {
    if (!bills) return { total: 0, pending: 0, overdue: 0, paid: 0 };
    return {
      total: bills.length,
      pending: bills.filter(b => b.status === "pending" || b.status === "approved").reduce((s, b) => s + Number(b.total), 0),
      overdue: bills.filter(b => b.status === "overdue").reduce((s, b) => s + Number(b.total), 0),
      paid: bills.filter(b => b.status === "paid").reduce((s, b) => s + Number(b.total), 0),
    };
  }, [bills]);

  return (
    <MainLayout title="Bills" subtitle="Accounts Payable — enter and pay vendor bills">
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex items-end gap-4">
          <div className="w-64">
            <Label>NGO</Label>
            <Select value={selectedNgoId} onValueChange={setSelectedNgoId}>
              <SelectTrigger><SelectValue placeholder="Select NGO" /></SelectTrigger>
              <SelectContent>{ngos?.map(n => <SelectItem key={n.id} value={n.id}>{n.legal_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {selectedNgoId && (
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-1" /> New Bill</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Enter Bill</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Bill #</Label><Input value={billNumber} onChange={e => setBillNumber(e.target.value)} /></div>
                    <div><Label>Due Date</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
                  </div>
                  <div><Label>Vendor Name</Label><Input value={vendorName} onChange={e => setVendorName(e.target.value)} /></div>
                  <div><Label>Total Amount</Label><Input type="number" value={total || ""} onChange={e => setTotal(Number(e.target.value))} /></div>
                  <div>
                    <Label>AP Account (Liability)</Label>
                    <Select value={apAccountId} onValueChange={setApAccountId}>
                      <SelectTrigger><SelectValue placeholder="Select AP account" /></SelectTrigger>
                      <SelectContent>{liabilityAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Expense Account</Label>
                    <Select value={expenseAccountId} onValueChange={setExpenseAccountId}>
                      <SelectTrigger><SelectValue placeholder="Select expense account" /></SelectTrigger>
                      <SelectContent>{expenseAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} /></div>
                  <Button onClick={handleCreate} className="w-full" disabled={!billNumber || !vendorName || !dueDate || total <= 0}>
                    Enter Bill
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {selectedNgoId && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Bills</p><p className="text-2xl font-bold">{summary.total}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pending</p><p className="text-2xl font-bold text-amber-600">${fmt(summary.pending)}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Overdue</p><p className="text-2xl font-bold text-destructive">${fmt(summary.overdue)}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Paid</p><p className="text-2xl font-bold text-emerald-600">${fmt(summary.paid)}</p></CardContent></Card>
            </div>

            <Card>
              <CardHeader><CardTitle>All Bills</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bill #</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Bill Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bills?.map(bill => (
                      <TableRow key={bill.id}>
                        <TableCell className="font-mono">{bill.bill_number}</TableCell>
                        <TableCell>{bill.vendor_name}</TableCell>
                        <TableCell>{format(new Date(bill.bill_date), "MMM d, yyyy")}</TableCell>
                        <TableCell>{format(new Date(bill.due_date), "MMM d, yyyy")}</TableCell>
                        <TableCell className="text-right font-mono">${fmt(Number(bill.total))}</TableCell>
                        <TableCell><Badge variant={bill.status === "paid" ? "default" : bill.status === "overdue" ? "destructive" : "outline"} className="capitalize">{bill.status}</Badge></TableCell>
                        <TableCell>
                          {(bill.status === "pending" || bill.status === "approved" || bill.status === "overdue") && (
                            <Button variant="ghost" size="sm" onClick={() => handleRecordPayment(bill)}>
                              <DollarSign className="w-3 h-3 mr-1" /> Pay
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!bills || bills.length === 0) && (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No bills yet</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  );
}
