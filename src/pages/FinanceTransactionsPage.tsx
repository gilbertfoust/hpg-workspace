import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MainLayout } from "@/components/layout/MainLayout";
import { useFinanceAccounts } from "@/hooks/useFinanceAccounts";
import { useFinanceFunds } from "@/hooks/useFinanceFunds";
import { useVoidFinancePayment } from "@/hooks/useFinancePayments";
import {
  useFinanceExpenseTransactions,
  usePostFinanceExpenseTransaction,
} from "@/hooks/useFinanceTransactions";
import { useWorkspaceNgo } from "@/hooks/useWorkspaceNgo";
import {
  FINANCE_PAYMENT_METHOD_LABELS,
  type FinancePaymentMethod,
} from "@/types/financeAccounting";
import { Ban, BookOpenCheck, CheckCircle2, FileUp, Loader2, Receipt, Send, WalletCards } from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);
const money = (amount: number) => amount.toLocaleString(undefined, { style: "currency", currency: "USD" });

const methodKeys = Object.keys(FINANCE_PAYMENT_METHOD_LABELS) as FinancePaymentMethod[];

const FinanceTransactionsPage = () => {
  const navigate = useNavigate();
  const { selectedNgo, selectedNgoId } = useWorkspaceNgo();
  const { data: accounts = [], isLoading: accountsLoading } = useFinanceAccounts();
  const { data: funds = [] } = useFinanceFunds();
  const { data: transactions = [], isLoading: transactionsLoading } = useFinanceExpenseTransactions(selectedNgoId);
  const postTransaction = usePostFinanceExpenseTransaction();
  const voidTransaction = useVoidFinancePayment();

  const [paymentDate, setPaymentDate] = useState(today);
  const [payeeName, setPayeeName] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseAccountId, setExpenseAccountId] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<FinancePaymentMethod>("ach");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [fundId, setFundId] = useState("none");
  const [memo, setMemo] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  const expenseAccounts = useMemo(
    () => accounts.filter((account) => account.account_type === "expense"),
    [accounts],
  );
  const paidFromAccounts = useMemo(() => accounts.filter((account) => {
    if (paymentMethod === "credit_card") return account.account_type === "liability";
    if (paymentMethod === "other") return account.account_type === "asset" || account.account_type === "liability";
    return account.account_type === "asset";
  }), [accounts, paymentMethod]);
  const scopedFunds = useMemo(
    () => funds.filter((fund) => !fund.ngo_id || fund.ngo_id === selectedNgoId),
    [funds, selectedNgoId],
  );
  const accountMap = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);

  useEffect(() => {
    if (!expenseAccountId && expenseAccounts.length) setExpenseAccountId(expenseAccounts[0].id);
  }, [expenseAccountId, expenseAccounts]);

  useEffect(() => {
    if (!paidFromAccounts.some((account) => account.id === paymentAccountId)) {
      const preferred = paidFromAccounts.find((account) => account.is_cash_account) ?? paidFromAccounts[0];
      setPaymentAccountId(preferred?.id ?? "");
    }
  }, [paidFromAccounts, paymentAccountId]);

  useEffect(() => {
    setFundId("none");
  }, [selectedNgoId]);

  const clearForm = () => {
    setPaymentDate(today());
    setPayeeName("");
    setAmount("");
    setReferenceNumber("");
    setFundId("none");
    setMemo("");
    setReceiptFile(null);
    setFileInputKey((key) => key + 1);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedNgoId || !expenseAccountId || !paymentAccountId) return;

    await postTransaction.mutateAsync({
      ngo_id: selectedNgoId,
      expense_account_id: expenseAccountId,
      payment_account_id: paymentAccountId,
      payment_method: paymentMethod,
      payment_date: paymentDate,
      amount: Number(amount),
      payee_name: payeeName,
      memo,
      reference_number: referenceNumber,
      fund_id: fundId === "none" ? null : fundId,
      receipt: receiptFile,
    });
    clearForm();
  };

  const handleVoid = (id: string, paymentNumber: string) => {
    const reason = window.prompt(`Reason for voiding ${paymentNumber}?`);
    if (!reason?.trim()) return;
    voidTransaction.mutate({ id, reason: reason.trim() });
  };

  const entityName = selectedNgo?.common_name || selectedNgo?.legal_name || "All HPG";
  const formReady = Boolean(
    selectedNgoId
    && payeeName.trim()
    && Number(amount) > 0
    && expenseAccountId
    && paymentAccountId
    && paymentDate,
  );

  return (
    <MainLayout
      title="Transactions"
      subtitle={`Enter expenses and post them directly to the balanced ledger for ${entityName}.`}
    >
      <div className="space-y-6">
        {!selectedNgoId && (
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardContent className="py-4 text-sm">
              Select an NGO in the workspace header before entering a transaction. “All HPG” remains available for consolidated reporting.
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><WalletCards className="h-4 w-4" />New expense transaction</CardTitle>
            <CardDescription>
              One submission creates the payment record, attaches the receipt, posts both sides of the journal entry, and updates reports immediately.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label>Entity</Label>
                  <Input value={entityName} readOnly className="bg-muted/40" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transaction-date">Date</Label>
                  <Input id="transaction-date" type="date" max={today()} value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <Label htmlFor="transaction-payee">Payee *</Label>
                  <Input id="transaction-payee" value={payeeName} onChange={(event) => setPayeeName(event.target.value)} placeholder="Vendor or person paid" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transaction-amount">Amount *</Label>
                  <Input id="transaction-amount" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <Label>Expense account *</Label>
                  <Select value={expenseAccountId} onValueChange={setExpenseAccountId} disabled={accountsLoading}>
                    <SelectTrigger><SelectValue placeholder="Select expense account" /></SelectTrigger>
                    <SelectContent>
                      {expenseAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>{account.code} — {account.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fund</Label>
                  <Select value={fundId} onValueChange={setFundId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No fund</SelectItem>
                      {scopedFunds.map((fund) => <SelectItem key={fund.id} value={fund.id}>{fund.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Paid by *</Label>
                  <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as FinancePaymentMethod)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {methodKeys.map((method) => <SelectItem key={method} value={method}>{FINANCE_PAYMENT_METHOD_LABELS[method]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <Label>Paid from account *</Label>
                  <Select value={paymentAccountId} onValueChange={setPaymentAccountId}>
                    <SelectTrigger><SelectValue placeholder="Select cash, bank, or card account" /></SelectTrigger>
                    <SelectContent>
                      {paidFromAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>{account.code} — {account.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transaction-reference">Reference</Label>
                  <Input id="transaction-reference" value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} placeholder="Check #, confirmation, last 4" />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="transaction-memo">Business purpose / memo</Label>
                  <Textarea id="transaction-memo" value={memo} onChange={(event) => setMemo(event.target.value)} rows={3} placeholder="What was purchased and why?" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transaction-receipt">Receipt</Label>
                  <div className="rounded-md border border-dashed p-3">
                    <Input
                      key={fileInputKey}
                      id="transaction-receipt"
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(event) => setReceiptFile(event.target.files?.[0] ?? null)}
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      {receiptFile ? `${receiptFile.name} · ${(receiptFile.size / 1024 / 1024).toFixed(2)} MB` : "PDF or image, up to 15 MB. Missing receipts remain visible in the receipt report."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />Debits and credits are validated before anything is saved.
                </div>
                <Button type="submit" disabled={!formReady || postTransaction.isPending}>
                  {postTransaction.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Post transaction
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base"><Receipt className="h-4 w-4" />Posted expense register</CardTitle>
              <CardDescription>Every row is linked to its balanced journal entry and supporting receipt.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/financial-hub/accounting/journal-entries")}>
              <BookOpenCheck className="mr-2 h-4 w-4" />Open journal
            </Button>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : !transactions.length ? (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">No expense transactions have been posted for this scope.</div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                      <th className="p-3">Transaction</th><th className="p-3">Date</th><th className="p-3">Payee</th>
                      <th className="p-3">Expense account</th><th className="p-3">Paid by</th><th className="p-3">Receipt</th>
                      <th className="p-3 text-right">Amount</th><th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((transaction) => (
                      <tr key={transaction.id} className="border-b last:border-0">
                        <td className="p-3"><span className="font-mono text-xs">{transaction.payment_number}</span><div><Badge variant={transaction.status === "posted" ? "default" : "secondary"}>{transaction.status}</Badge></div></td>
                        <td className="p-3">{transaction.payment_date}</td>
                        <td className="p-3"><p className="font-medium">{transaction.payee_name}</p><p className="max-w-52 truncate text-xs text-muted-foreground">{transaction.reference_number || transaction.memo || "—"}</p></td>
                        <td className="p-3">{accountMap.get(transaction.expense_account_id ?? "")?.name || "—"}</td>
                        <td className="p-3"><p>{transaction.payment_method ? FINANCE_PAYMENT_METHOD_LABELS[transaction.payment_method] : "—"}</p><p className="text-xs text-muted-foreground">{accountMap.get(transaction.payment_account_id ?? "")?.name || "—"}</p></td>
                        <td className="p-3">{transaction.document_id ? <Badge variant="outline"><FileUp className="mr-1 h-3 w-3" />Attached</Badge> : <Badge variant="secondary">Missing</Badge>}</td>
                        <td className="p-3 text-right font-medium">{money(transaction.amount)}</td>
                        <td className="p-3 text-right">
                          {transaction.status === "posted" && (
                            <Button variant="ghost" size="sm" className="text-destructive" disabled={voidTransaction.isPending} onClick={() => handleVoid(transaction.id, transaction.payment_number)}>
                              <Ban className="mr-1 h-3 w-3" />Void
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
      </div>
    </MainLayout>
  );
};

export default FinanceTransactionsPage;
