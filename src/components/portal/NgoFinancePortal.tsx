import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, CheckCircle2, FileCheck2, Landmark, Loader2, PlusCircle, Send } from "lucide-react";
import { useNgoPortalFinance } from "@/hooks/useNgoPortalFinance";
import { useUploadDocument } from "@/hooks/useDocuments";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function NgoFinancePortal({ ngoId }: { ngoId: string }) {
  const finance = useNgoPortalFinance(ngoId);
  const uploadDocument = useUploadDocument();
  const [expense, setExpense] = useState({
    expenseAccountId: "", paymentAccountId: "", paymentMethod: "ach",
    paymentDate: format(new Date(), "yyyy-MM-dd"), amount: "", payeeName: "",
    referenceNumber: "", memo: "",
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [account, setAccount] = useState({ code: "", name: "", accountType: "expense", normalBalance: "debit", businessReason: "" });
  const now = new Date();
  const [quarterYear, setQuarterYear] = useState(now.getFullYear());
  const [quarterNumber, setQuarterNumber] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [noActivity, setNoActivity] = useState(false);

  const accounts = finance.accounts.data ?? [];
  const expenseAccounts = useMemo(() => accounts.filter((item) => item.account_type === "expense"), [accounts]);
  const paymentAccounts = useMemo(() => accounts.filter((item) => item.account_type === "asset" || item.account_type === "liability"), [accounts]);
  const selectedQuarter = (finance.quarters.data ?? []).find((item) => item.fiscal_year === quarterYear && item.quarter === quarterNumber);
  const readiness = selectedQuarter?.readiness_json as Record<string, unknown> | undefined;
  const busy = finance.postExpense.isPending || uploadDocument.isPending;

  const submitExpense = async () => {
    if (!expense.expenseAccountId || !expense.paymentAccountId || !expense.payeeName || !Number(expense.amount)) return;
    let documentId: string | undefined;
    if (receiptFile) {
      const document = await uploadDocument.mutateAsync({ file: receiptFile, ngoId, category: "finance", reviewStatus: "Pending" });
      documentId = document.id;
    }
    await finance.postExpense.mutateAsync({ ...expense, amount: Number(expense.amount), documentId });
    setExpense((current) => ({ ...current, amount: "", payeeName: "", referenceNumber: "", memo: "" }));
    setReceiptFile(null);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-start gap-3"><Landmark className="mt-0.5 h-5 w-5 text-primary" /><div><p className="font-medium">Live NGO accounting</p><p className="text-sm text-muted-foreground">Transactions post balanced debit/credit entries immediately. Only HPG Finance-approved accounts can be used.</p></div></div>
      </div>

      <Tabs defaultValue="transactions">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="quarters">Quarterly submission</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-5">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><PlusCircle className="h-5 w-5" />Record an expense</CardTitle><CardDescription>Choose what was purchased, how it was paid, and attach the receipt.</CardDescription></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>Expense account</Label><Select value={expense.expenseAccountId} onValueChange={(value) => setExpense({ ...expense, expenseAccountId: value })}><SelectTrigger><SelectValue placeholder="Select approved expense account" /></SelectTrigger><SelectContent>{expenseAccounts.map((item) => <SelectItem key={item.id} value={item.id}>{item.code} — {item.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Paid from</Label><Select value={expense.paymentAccountId} onValueChange={(value) => setExpense({ ...expense, paymentAccountId: value })}><SelectTrigger><SelectValue placeholder="Select bank, cash, or card account" /></SelectTrigger><SelectContent>{paymentAccounts.map((item) => <SelectItem key={item.id} value={item.id}>{item.code} — {item.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Payee</Label><Input value={expense.payeeName} onChange={(event) => setExpense({ ...expense, payeeName: event.target.value })} /></div>
              <div className="space-y-2"><Label>Amount</Label><Input type="number" min="0" step="0.01" value={expense.amount} onChange={(event) => setExpense({ ...expense, amount: event.target.value })} /></div>
              <div className="space-y-2"><Label>Payment date</Label><Input type="date" value={expense.paymentDate} onChange={(event) => setExpense({ ...expense, paymentDate: event.target.value })} /></div>
              <div className="space-y-2"><Label>Payment method</Label><Select value={expense.paymentMethod} onValueChange={(value) => setExpense({ ...expense, paymentMethod: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["cash","check","ach","debit_card","credit_card","wire","other"].map((value) => <SelectItem key={value} value={value}>{value.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Reference</Label><Input value={expense.referenceNumber} onChange={(event) => setExpense({ ...expense, referenceNumber: event.target.value })} placeholder="Check, ACH, or wire reference" /></div>
              <div className="space-y-2"><Label>Receipt</Label><Input type="file" accept="image/*,application/pdf" onChange={(event) => setReceiptFile(event.target.files?.[0] ?? null)} /></div>
              <div className="space-y-2 md:col-span-2"><Label>Memo</Label><Input value={expense.memo} onChange={(event) => setExpense({ ...expense, memo: event.target.value })} /></div>
              <div className="md:col-span-2"><Button disabled={busy || !expense.expenseAccountId || !expense.paymentAccountId || !expense.payeeName || !expense.amount} onClick={submitExpense}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Post balanced transaction</Button></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Recent transactions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {finance.transactions.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (finance.transactions.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No transactions recorded yet.</p> : (finance.transactions.data ?? []).map((transaction) => (
                <div key={transaction.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"><div><p className="font-medium">{transaction.payee_name}</p><p className="text-xs text-muted-foreground">{transaction.payment_date} · {transaction.payment_method?.replaceAll("_", " ")} · {transaction.payment_number}</p></div><div className="flex items-center gap-2"><Badge variant={transaction.document_id ? "default" : "destructive"}>{transaction.document_id ? "Receipt" : "Receipt missing"}</Badge><p className="font-semibold">{money.format(Number(transaction.amount))}</p></div></div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accounts" className="space-y-5">
          <Card>
            <CardHeader><CardTitle>Request a new account</CardTitle><CardDescription>HPG Finance approves the account before it becomes available in your ledger or budget.</CardDescription></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>Account code</Label><Input value={account.code} onChange={(event) => setAccount({ ...account, code: event.target.value })} /></div>
              <div className="space-y-2"><Label>Account name</Label><Input value={account.name} onChange={(event) => setAccount({ ...account, name: event.target.value })} /></div>
              <div className="space-y-2"><Label>Account type</Label><Select value={account.accountType} onValueChange={(value) => setAccount({ ...account, accountType: value, normalBalance: ["asset","expense"].includes(value) ? "debit" : "credit" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["asset","liability","equity","revenue","expense"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Normal balance</Label><Select value={account.normalBalance} onValueChange={(value) => setAccount({ ...account, normalBalance: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="debit">Debit</SelectItem><SelectItem value="credit">Credit</SelectItem></SelectContent></Select></div>
              <div className="space-y-2 md:col-span-2"><Label>Why is this account needed?</Label><Textarea value={account.businessReason} onChange={(event) => setAccount({ ...account, businessReason: event.target.value })} /></div>
              <div className="md:col-span-2"><Button disabled={finance.requestAccount.isPending || !account.code || !account.name || !account.businessReason} onClick={() => finance.requestAccount.mutate(account)}>{finance.requestAccount.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send for Finance approval</Button></div>
            </CardContent>
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            <Card><CardHeader><CardTitle>Approved chart of accounts</CardTitle></CardHeader><CardContent className="space-y-2">{accounts.map((item) => <div key={item.id} className="flex justify-between rounded border p-2 text-sm"><span>{item.code} — {item.name}</span><Badge variant="outline">{item.account_type}</Badge></div>)}</CardContent></Card>
            <Card><CardHeader><CardTitle>Approval queue</CardTitle></CardHeader><CardContent className="space-y-2">{(finance.accountRequests.data ?? []).map((item: any) => <div key={item.id} className="flex justify-between rounded border p-2 text-sm"><span>{item.requested_code} — {item.requested_name}</span><Badge variant={item.status === "approved" ? "default" : "secondary"}>{item.status}</Badge></div>)}</CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="quarters" className="space-y-5">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FileCheck2 className="h-5 w-5" />Quarterly accounting package</CardTitle><CardDescription>Refresh readiness, correct any blocking items, then submit the locked quarter to HPG Finance.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3"><Input className="w-32" type="number" value={quarterYear} onChange={(event) => setQuarterYear(Number(event.target.value))} /><Select value={String(quarterNumber)} onValueChange={(value) => setQuarterNumber(Number(value))}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent>{[1,2,3,4].map((q) => <SelectItem key={q} value={String(q)}>Quarter {q}</SelectItem>)}</SelectContent></Select><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={noActivity} onChange={(event) => setNoActivity(event.target.checked)} />No financial activity</label><Button variant="outline" disabled={finance.prepareQuarter.isPending} onClick={() => finance.prepareQuarter.mutate({ year: quarterYear, quarter: quarterNumber, noActivity })}>{finance.prepareQuarter.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Refresh readiness</Button></div>
              {selectedQuarter && <div className="rounded-lg border p-4 space-y-3"><div className="flex items-center justify-between"><p className="font-medium">{quarterYear} Quarter {quarterNumber}</p><Badge>{selectedQuarter.status.replaceAll("_", " ")}</Badge></div><div className="grid gap-3 sm:grid-cols-4"><Readiness label="Balanced journal" passed={Boolean(readiness?.is_balanced)} value={String(readiness?.is_balanced ?? false)} /><Readiness label="Draft entries" passed={Number(readiness?.draft_entries ?? 0) === 0} value={String(readiness?.draft_entries ?? 0)} /><Readiness label="Missing receipts" passed={Number(readiness?.missing_receipts ?? 0) === 0} value={String(readiness?.missing_receipts ?? 0)} /><Readiness label="Pending accounts" passed={Number(readiness?.pending_account_requests ?? 0) === 0} value={String(readiness?.pending_account_requests ?? 0)} /></div>{selectedQuarter.review_notes && <div className="rounded bg-amber-50 p-3 text-sm text-amber-900">HPG Finance: {selectedQuarter.review_notes}</div>}{["draft","changes_requested"].includes(selectedQuarter.status) && <Button disabled={finance.submitQuarter.isPending || !Boolean(readiness?.is_ready)} onClick={() => finance.submitQuarter.mutate(selectedQuarter.id)}><Send className="mr-2 h-4 w-4" />Submit quarter to HPG Finance</Button>}</div>}
            </CardContent>
          </Card>
          <Card><CardHeader><CardTitle>Submission history</CardTitle></CardHeader><CardContent className="space-y-2">{(finance.quarters.data ?? []).map((quarter) => <div key={quarter.id} className="flex items-center justify-between rounded border p-3"><span>{quarter.fiscal_year} · Q{quarter.quarter}</span><Badge variant={quarter.status === "approved" || quarter.status === "certified" ? "default" : "secondary"}>{quarter.status.replaceAll("_", " ")}</Badge></div>)}</CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Readiness({ label, passed, value }: { label: string; passed: boolean; value: string }) {
  return <div className="rounded-md border p-3"><div className="flex items-center gap-2 text-sm">{passed ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}<span>{label}</span></div><p className="mt-1 text-lg font-semibold">{value}</p></div>;
}
