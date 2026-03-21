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
import { Plus, Send, CheckCircle, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNGOs } from "@/hooks/useNGOs";
import { useInvoices } from "@/hooks/useInvoices";
import { useExtendedAccounts } from "@/hooks/useExtendedAccounts";
import { useTransactions } from "@/hooks/useTransactions";
import { format } from "date-fns";

function fmt(n: number) { return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

const statusColors: Record<string, string> = {
  draft: "outline",
  sent: "secondary",
  paid: "default",
  overdue: "destructive",
  void: "outline",
};

export default function InvoicesPage() {
  const { toast } = useToast();
  const { data: ngos } = useNGOs();
  const [selectedNgoId, setSelectedNgoId] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const { data: invoices, create: createInvoice, update: updateInvoice } = useInvoices(selectedNgoId || undefined);
  const { data: accounts } = useExtendedAccounts(selectedNgoId || undefined);
  const { create: createTransaction } = useTransactions(selectedNgoId || undefined);

  // Form state
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [total, setTotal] = useState(0);
  const [notes, setNotes] = useState("");
  const [arAccountId, setArAccountId] = useState("");
  const [revenueAccountId, setRevenueAccountId] = useState("");

  const arAccounts = accounts?.filter(a => a.type === "asset") || [];
  const revenueAccounts = accounts?.filter(a => a.type === "income") || [];

  const resetForm = () => {
    setInvoiceNumber(""); setCustomerName(""); setCustomerEmail("");
    setDueDate(""); setTotal(0); setNotes(""); setArAccountId(""); setRevenueAccountId("");
  };

  const handleCreate = async () => {
    if (!selectedNgoId || !invoiceNumber || !customerName || !dueDate || total <= 0) return;
    try {
      await createInvoice.mutateAsync({
        ngo_id: selectedNgoId,
        invoice_number: invoiceNumber,
        customer_name: customerName,
        customer_email: customerEmail || undefined,
        due_date: dueDate,
        subtotal: total,
        total,
        ar_account_id: arAccountId || undefined,
        notes: notes || undefined,
      });
      toast({ title: "Invoice created" });
      resetForm();
      setShowCreate(false);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleSend = async (id: string) => {
    try {
      await updateInvoice.mutateAsync({ id, status: "sent" });
      toast({ title: "Invoice marked as sent" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleRecordPayment = async (inv: any) => {
    if (!inv.ar_account_id && !arAccountId) {
      toast({ variant: "destructive", title: "Set AR account first" });
      return;
    }
    try {
      // Create journal entry: DR Cash, CR AR
      const cashAccount = accounts?.find(a => a.name.toLowerCase().includes("cash") && a.type === "asset");
      if (!cashAccount) {
        toast({ variant: "destructive", title: "No cash account found in chart of accounts" });
        return;
      }
      const arId = inv.ar_account_id || arAccountId;
      const txn = await createTransaction.mutateAsync({
        transaction: {
          ngo_id: inv.ngo_id,
          transaction_date: format(new Date(), "yyyy-MM-dd"),
          description: `Payment received: Invoice #${inv.invoice_number} - ${inv.customer_name}`,
          reference_number: `PMT-${inv.invoice_number}`,
          fiscal_period_id: inv.fiscal_period_id,
          created_by_user_id: null,
        },
        entries: [
          { account_id: cashAccount.id, debit: Number(inv.total), credit: 0, memo: "Cash received" },
          { account_id: arId, debit: 0, credit: Number(inv.total), memo: "AR cleared" },
        ],
      });
      await updateInvoice.mutateAsync({
        id: inv.id,
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
    if (!invoices) return { total: 0, outstanding: 0, overdue: 0, paid: 0 };
    return {
      total: invoices.length,
      outstanding: invoices.filter(i => i.status === "sent").reduce((s, i) => s + Number(i.total), 0),
      overdue: invoices.filter(i => i.status === "overdue").reduce((s, i) => s + Number(i.total), 0),
      paid: invoices.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.total), 0),
    };
  }, [invoices]);

  return (
    <MainLayout title="Invoices" subtitle="Accounts Receivable — create, send, and track customer invoices">
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
                <Button><Plus className="w-4 h-4 mr-1" /> New Invoice</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Create Invoice</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Invoice #</Label><Input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} /></div>
                    <div><Label>Due Date</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
                  </div>
                  <div><Label>Customer Name</Label><Input value={customerName} onChange={e => setCustomerName(e.target.value)} /></div>
                  <div><Label>Customer Email</Label><Input value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} /></div>
                  <div><Label>Total Amount</Label><Input type="number" value={total || ""} onChange={e => setTotal(Number(e.target.value))} /></div>
                  <div>
                    <Label>AR Account</Label>
                    <Select value={arAccountId} onValueChange={setArAccountId}>
                      <SelectTrigger><SelectValue placeholder="Select AR account" /></SelectTrigger>
                      <SelectContent>{arAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} /></div>
                  <Button onClick={handleCreate} className="w-full" disabled={!invoiceNumber || !customerName || !dueDate || total <= 0}>
                    Create Invoice
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {selectedNgoId && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Invoices</p><p className="text-2xl font-bold">{summary.total}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Outstanding</p><p className="text-2xl font-bold text-amber-600">${fmt(summary.outstanding)}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Overdue</p><p className="text-2xl font-bold text-destructive">${fmt(summary.overdue)}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Paid</p><p className="text-2xl font-bold text-emerald-600">${fmt(summary.paid)}</p></CardContent></Card>
            </div>

            <Card>
              <CardHeader><CardTitle>All Invoices</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Issue Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices?.map(inv => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono">{inv.invoice_number}</TableCell>
                        <TableCell>{inv.customer_name}</TableCell>
                        <TableCell>{format(new Date(inv.issue_date), "MMM d, yyyy")}</TableCell>
                        <TableCell>{format(new Date(inv.due_date), "MMM d, yyyy")}</TableCell>
                        <TableCell className="text-right font-mono">${fmt(Number(inv.total))}</TableCell>
                        <TableCell>
                          <Badge variant={statusColors[inv.status] as any} className="capitalize">{inv.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {inv.status === "draft" && (
                              <Button variant="ghost" size="sm" onClick={() => handleSend(inv.id)}>
                                <Send className="w-3 h-3 mr-1" /> Send
                              </Button>
                            )}
                            {(inv.status === "sent" || inv.status === "overdue") && (
                              <Button variant="ghost" size="sm" onClick={() => handleRecordPayment(inv)}>
                                <DollarSign className="w-3 h-3 mr-1" /> Record Payment
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!invoices || invoices.length === 0) && (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No invoices yet</TableCell></TableRow>
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
