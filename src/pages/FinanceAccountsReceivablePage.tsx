import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useCreateFinanceDonor,
  useCreateFinanceInvoice,
  useFinanceArAging,
  useFinanceDonors,
  useFinanceInvoices,
  useRecordFinanceInvoicePayment,
} from "@/hooks/useFinanceInvoices";
import { hasFinancePermission } from "@/lib/financePermissions";
import { useUserRole } from "@/hooks/useUserRole";

const fmt = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

const FinanceAccountsReceivablePage = () => {
  const { role } = useUserRole();
  const canManage = hasFinancePermission(role, "manage_ledger");
  const { data: donors = [] } = useFinanceDonors();
  const { data: invoices = [] } = useFinanceInvoices();
  const { data: aging = [] } = useFinanceArAging();
  const createDonor = useCreateFinanceDonor();
  const createInvoice = useCreateFinanceInvoice();
  const recordPayment = useRecordFinanceInvoicePayment();

  const [donorName, setDonorName] = useState("");
  const [invNumber, setInvNumber] = useState("");
  const [invCustomer, setInvCustomer] = useState("");
  const [invTotal, setInvTotal] = useState(0);
  const [payAmount, setPayAmount] = useState(0);
  const [payInvoiceId, setPayInvoiceId] = useState("");

  return (
    <MainLayout title="Accounts Receivable" subtitle="Donors, invoices, payments, and AR aging">
      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="donors">Donors</TabsTrigger>
          <TabsTrigger value="aging">AR Aging</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="mt-4 space-y-4">
          {canManage && (
            <Card>
              <CardHeader><CardTitle className="text-base">New invoice</CardTitle></CardHeader>
              <CardContent className="grid md:grid-cols-4 gap-3">
                <div><Label>Invoice #</Label><Input value={invNumber} onChange={(e) => setInvNumber(e.target.value)} /></div>
                <div><Label>Customer</Label><Input value={invCustomer} onChange={(e) => setInvCustomer(e.target.value)} /></div>
                <div><Label>Total</Label><Input type="number" value={invTotal} onChange={(e) => setInvTotal(Number(e.target.value))} /></div>
                <div className="flex items-end">
                  <Button
                    disabled={!invNumber || invTotal <= 0}
                    onClick={() => createInvoice.mutate({
                      invoice_number: invNumber,
                      customer_name: invCustomer,
                      invoice_date: new Date().toISOString().slice(0, 10),
                      total: invTotal,
                    }, { onSuccess: () => { setInvNumber(""); setInvCustomer(""); setInvTotal(0); } })}
                  >
                    Create
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Customer</TableHead><TableHead>Status</TableHead><TableHead>Total</TableHead><TableHead>Paid</TableHead></TableRow></TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono">{inv.invoice_number}</TableCell>
                      <TableCell>{inv.customer_name || "—"}</TableCell>
                      <TableCell>{inv.status}</TableCell>
                      <TableCell>{fmt(inv.total)}</TableCell>
                      <TableCell>{fmt(inv.amount_paid)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          {canManage && (
            <Card>
              <CardHeader><CardTitle className="text-base">Record payment</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-3 items-end">
                <div><Label>Invoice ID</Label><Input value={payInvoiceId} onChange={(e) => setPayInvoiceId(e.target.value)} className="w-72" /></div>
                <div><Label>Amount</Label><Input type="number" value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value))} /></div>
                <Button disabled={!payInvoiceId || payAmount <= 0} onClick={() => recordPayment.mutate({
                  invoiceId: payInvoiceId, amount: payAmount, paymentDate: new Date().toISOString().slice(0, 10),
                })}>Record</Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="donors" className="mt-4 space-y-4">
          {canManage && (
            <Card>
              <CardContent className="pt-6 flex gap-3">
                <Input placeholder="Donor name" value={donorName} onChange={(e) => setDonorName(e.target.value)} />
                <Button disabled={!donorName.trim()} onClick={() => createDonor.mutate({ name: donorName }, { onSuccess: () => setDonorName("") })}>Add donor</Button>
              </CardContent>
            </Card>
          )}
          <Card><CardContent className="pt-6">
            <ul className="space-y-2">{donors.map((d) => <li key={d.id}>{d.name} {d.organization_name ? `(${d.organization_name})` : ""}</li>)}</ul>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="aging" className="mt-4">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Due</TableHead><TableHead>Balance</TableHead><TableHead>Bucket</TableHead></TableRow></TableHeader>
              <TableBody>
                {aging.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell>{row.invoice_number}</TableCell>
                    <TableCell>{row.due_date || "—"}</TableCell>
                    <TableCell>{fmt(row.balance)}</TableCell>
                    <TableCell>{row.bucket}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
};

export default FinanceAccountsReceivablePage;
