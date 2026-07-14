import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useCreateFinanceDonor,
  useFinanceArAging,
  useFinanceDonors,
  useFinanceInvoices,
  useIssueFinanceInvoice,
  useRecordFinanceInvoicePayment,
  useSaveFinanceInvoice,
  useVoidFinanceInvoice,
  useWriteOffFinanceInvoice,
} from "@/hooks/useFinanceInvoices";
import { useFinanceAccounts } from "@/hooks/useFinanceAccounts";
import { useFinanceBankAccounts } from "@/hooks/useFinanceBankAccounts";
import { hasFinancePermission } from "@/lib/financePermissions";
import { useUserRole } from "@/hooks/useUserRole";
import { useWorkspaceNgo } from "@/hooks/useWorkspaceNgo";

const fmt = (value: number) => value.toLocaleString(undefined, { style: "currency", currency: "USD" });
const today = () => new Date().toISOString().slice(0, 10);

const FinanceAccountsReceivablePage = () => {
  const { role } = useUserRole();
  const canManage = hasFinancePermission(role, "manage_ledger");
  const { selectedNgo, selectedNgoId } = useWorkspaceNgo();
  const { data: donors = [] } = useFinanceDonors(selectedNgoId);
  const { data: invoices = [] } = useFinanceInvoices(selectedNgoId);
  const { data: aging = [] } = useFinanceArAging(selectedNgoId);
  const { data: accounts = [] } = useFinanceAccounts();
  const { data: bankAccounts = [] } = useFinanceBankAccounts({ ngoId: selectedNgoId });
  const revenueAccounts = accounts.filter((account) => account.account_type === "revenue");

  const createDonor = useCreateFinanceDonor();
  const saveInvoice = useSaveFinanceInvoice();
  const issueInvoice = useIssueFinanceInvoice();
  const recordPayment = useRecordFinanceInvoicePayment();
  const writeOffInvoice = useWriteOffFinanceInvoice();
  const voidInvoice = useVoidFinanceInvoice();

  const [donorName, setDonorName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [dueDate, setDueDate] = useState(today());
  const [revenueAccountId, setRevenueAccountId] = useState("none");
  const [lineDescription, setLineDescription] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [paymentInvoiceId, setPaymentInvoiceId] = useState("none");
  const [paymentBankId, setPaymentBankId] = useState("none");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("ach");

  const openInvoices = useMemo(
    () => invoices.filter((invoice) => ["sent", "partial"].includes(invoice.status)),
    [invoices],
  );

  const saveDraft = async () => {
    if (!selectedNgoId || revenueAccountId === "none" || Number(invoiceAmount) <= 0) return;
    await saveInvoice.mutateAsync({
      header: {
        ngo_id: selectedNgoId,
        invoice_number: invoiceNumber || undefined,
        customer_name: customerName,
        invoice_date: invoiceDate,
        due_date: dueDate,
      },
      lines: [{
        account_id: revenueAccountId,
        description: lineDescription.trim() || customerName || "Invoice revenue",
        amount: Number(invoiceAmount),
      }],
    });
    setInvoiceNumber("");
    setCustomerName("");
    setLineDescription("");
    setInvoiceAmount("");
  };

  const postReceipt = async () => {
    if (paymentInvoiceId === "none" || paymentBankId === "none" || Number(paymentAmount) <= 0) return;
    await recordPayment.mutateAsync({
      invoiceId: paymentInvoiceId,
      amount: Number(paymentAmount),
      paymentDate: today(),
      bankAccountId: paymentBankId,
      paymentMethod,
    });
    setPaymentAmount("");
  };

  return (
    <MainLayout
      title="Accounts Receivable"
      subtitle={`Live-wired invoices, receipts, and AR aging for ${selectedNgo?.common_name || selectedNgo?.legal_name || "a selected NGO"}`}
    >
      {!selectedNgoId ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Select an NGO in the workspace header to work in its receivables ledger.</CardContent></Card>
      ) : (
        <Tabs defaultValue="invoices">
          <TabsList>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="receipts">Receive payment</TabsTrigger>
            <TabsTrigger value="donors">Donors</TabsTrigger>
            <TabsTrigger value="aging">AR Aging</TabsTrigger>
          </TabsList>

          <TabsContent value="invoices" className="mt-4 space-y-4">
            {canManage ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">New invoice draft</CardTitle>
                  <CardDescription>Saving creates a reviewable draft. Issuing posts Debit AR / Credit Revenue atomically.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-3">
                  <div><Label>Invoice # (optional)</Label><Input value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} placeholder="Generated automatically" /></div>
                  <div><Label>Customer / grantor</Label><Input value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></div>
                  <div><Label>Revenue account</Label>
                    <Select value={revenueAccountId} onValueChange={setRevenueAccountId}><SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="none">Select revenue account</SelectItem>{revenueAccounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.code} — {account.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Invoice date</Label><Input type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} /></div>
                  <div><Label>Due date</Label><Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></div>
                  <div><Label>Amount</Label><Input type="number" min="0" step="0.01" value={invoiceAmount} onChange={(event) => setInvoiceAmount(event.target.value)} /></div>
                  <div className="md:col-span-2"><Label>Description</Label><Input value={lineDescription} onChange={(event) => setLineDescription(event.target.value)} /></div>
                  <div className="flex items-end"><Button onClick={saveDraft} disabled={saveInvoice.isPending || revenueAccountId === "none" || Number(invoiceAmount) <= 0}>Save draft</Button></div>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardContent className="pt-6 overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Customer</TableHead><TableHead>Status</TableHead><TableHead>Total</TableHead><TableHead>Paid</TableHead><TableHead>Ledger</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => {
                      const openBalance = invoice.total - invoice.amount_paid - invoice.amount_written_off;
                      return (
                        <TableRow key={invoice.id}>
                          <TableCell><p className="font-mono">{invoice.invoice_number}</p><p className="text-xs text-muted-foreground">Due {invoice.due_date || "—"}</p></TableCell>
                          <TableCell>{invoice.customer_name || "—"}</TableCell>
                          <TableCell><Badge variant={invoice.status === "paid" ? "default" : invoice.status === "voided" ? "destructive" : "outline"}>{invoice.status}</Badge></TableCell>
                          <TableCell>{fmt(invoice.total)}</TableCell>
                          <TableCell>{fmt(invoice.amount_paid)}</TableCell>
                          <TableCell>{invoice.journal_entry_id ? <Badge>Posted</Badge> : <Badge variant="secondary">Draft—not in ledger</Badge>}</TableCell>
                          <TableCell><div className="flex flex-wrap gap-1">
                            {canManage && invoice.status === "draft" ? <Button size="sm" onClick={() => issueInvoice.mutate(invoice.id)} disabled={issueInvoice.isPending}>Issue & post</Button> : null}
                            {canManage && ["sent", "partial"].includes(invoice.status) && openBalance > 0 ? <Button size="sm" variant="outline" onClick={() => {
                              const raw = window.prompt(`Write-off amount (open balance ${fmt(openBalance)})`);
                              const reason = raw ? window.prompt("Reason for write-off") : null;
                              if (raw && reason?.trim()) writeOffInvoice.mutate({ invoiceId: invoice.id, amount: Number(raw), reason: reason.trim() });
                            }}>Write off</Button> : null}
                            {canManage && !["paid", "written_off", "voided"].includes(invoice.status) ? <Button size="sm" variant="ghost" onClick={() => {
                              const reason = window.prompt("Reason for voiding this invoice");
                              if (reason?.trim()) voidInvoice.mutate({ invoiceId: invoice.id, reason: reason.trim() });
                            }}>Void</Button> : null}
                          </div></TableCell>
                        </TableRow>
                      );
                    })}
                    {!invoices.length ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No invoices for this NGO.</TableCell></TableRow> : null}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="receipts" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Receive invoice payment</CardTitle><CardDescription>Posting updates cash and the AR control account in one transaction.</CardDescription></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-4">
                <div><Label>Open invoice</Label><Select value={paymentInvoiceId} onValueChange={setPaymentInvoiceId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Select invoice</SelectItem>{openInvoices.map((invoice) => <SelectItem key={invoice.id} value={invoice.id}>{invoice.invoice_number} — {fmt(invoice.total - invoice.amount_paid - invoice.amount_written_off)}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Deposit to</Label><Select value={paymentBankId} onValueChange={setPaymentBankId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Select bank account</SelectItem>{bankAccounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.account_name}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Method</Label><Select value={paymentMethod} onValueChange={setPaymentMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ach">ACH</SelectItem><SelectItem value="check">Check</SelectItem><SelectItem value="wire">Wire</SelectItem><SelectItem value="cash">Cash</SelectItem><SelectItem value="credit_card">Credit card</SelectItem></SelectContent></Select></div>
                <div><Label>Amount</Label><Input type="number" min="0" step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} /></div>
                <div className="md:col-span-4"><Button onClick={postReceipt} disabled={!canManage || recordPayment.isPending || paymentInvoiceId === "none" || paymentBankId === "none" || Number(paymentAmount) <= 0}>Post receipt to cash and AR</Button></div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="donors" className="mt-4 space-y-4">
            {canManage ? <Card><CardContent className="pt-6 flex gap-3"><Input placeholder="Donor name" value={donorName} onChange={(event) => setDonorName(event.target.value)} /><Button disabled={!donorName.trim()} onClick={() => createDonor.mutate({ name: donorName, ngo_id: selectedNgoId }, { onSuccess: () => setDonorName("") })}>Add donor</Button></CardContent></Card> : null}
            <Card><CardContent className="pt-6"><ul className="space-y-2">{donors.map((donor) => <li key={donor.id}>{donor.name} {donor.organization_name ? `(${donor.organization_name})` : ""}</li>)}</ul></CardContent></Card>
          </TabsContent>

          <TabsContent value="aging" className="mt-4">
            <Card><CardContent className="pt-6"><Table><TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Due</TableHead><TableHead>Balance</TableHead><TableHead>Bucket</TableHead></TableRow></TableHeader><TableBody>{aging.map((row, index) => <TableRow key={index}><TableCell>{row.invoice_number}</TableCell><TableCell>{row.due_date || "—"}</TableCell><TableCell>{fmt(row.balance)}</TableCell><TableCell>{row.bucket}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
          </TabsContent>
        </Tabs>
      )}
    </MainLayout>
  );
};

export default FinanceAccountsReceivablePage;
