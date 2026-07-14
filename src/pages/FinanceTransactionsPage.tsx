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
  type FinanceReceiptDraft,
  useAnalyzeFinanceReceipt,
  useDismissFinanceReceiptDraft,
  useFinanceExpenseTransactions,
  useFinanceReceiptDrafts,
  usePostFinanceExpenseTransaction,
  useRetryFinanceReceiptDraft,
} from "@/hooks/useFinanceTransactions";
import { useWorkspaceNgo } from "@/hooks/useWorkspaceNgo";
import {
  FINANCE_PAYMENT_METHOD_LABELS,
  type FinancePaymentMethod,
} from "@/types/financeAccounting";
import { AlertTriangle, Ban, BookOpenCheck, CheckCircle2, FileSearch, FileUp, Loader2, Receipt, RotateCcw, Send, Sparkles, WalletCards } from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);
const money = (amount: number) => amount.toLocaleString(undefined, { style: "currency", currency: "USD" });

const methodKeys = Object.keys(FINANCE_PAYMENT_METHOD_LABELS) as FinancePaymentMethod[];

const FinanceTransactionsPage = () => {
  const navigate = useNavigate();
  const { selectedNgo, selectedNgoId } = useWorkspaceNgo();
  const { data: accounts = [], isLoading: accountsLoading } = useFinanceAccounts();
  const { data: funds = [] } = useFinanceFunds();
  const { data: transactions = [], isLoading: transactionsLoading } = useFinanceExpenseTransactions(selectedNgoId);
  const { data: receiptDrafts = [], isLoading: receiptDraftsLoading } = useFinanceReceiptDrafts(selectedNgoId);
  const analyzeReceipt = useAnalyzeFinanceReceipt();
  const retryReceipt = useRetryFinanceReceiptDraft();
  const dismissReceipt = useDismissFinanceReceiptDraft();
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
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanInputKey, setScanInputKey] = useState(0);
  const [selectedReceiptDraftId, setSelectedReceiptDraftId] = useState<string | null>(null);

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
    setSelectedReceiptDraftId(null);
    setScanFile(null);
    setScanInputKey((key) => key + 1);
  }, [selectedNgoId]);

  const reviewReceiptDraft = (draft: FinanceReceiptDraft) => {
    setSelectedReceiptDraftId(draft.id);
    if (draft.transaction_date) setPaymentDate(draft.transaction_date);
    if (draft.merchant_name) setPayeeName(draft.merchant_name);
    if (draft.total_amount && draft.total_amount > 0) setAmount(draft.total_amount.toFixed(2));
    if (draft.suggested_expense_account_id) setExpenseAccountId(draft.suggested_expense_account_id);
    if (draft.payment_method) setPaymentMethod(draft.payment_method);
    if (draft.suggested_payment_account_id) setPaymentAccountId(draft.suggested_payment_account_id);
    setReferenceNumber(draft.reference_number || "");
    setMemo(draft.memo || "");
    setReceiptFile(null);
    setFileInputKey((key) => key + 1);
    globalThis.document?.getElementById("expense-transaction-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleAnalyzeReceipt = async () => {
    if (!selectedNgoId || !scanFile) return;
    try {
      const result = await analyzeReceipt.mutateAsync({ ngoId: selectedNgoId, file: scanFile });
      setScanFile(null);
      setScanInputKey((key) => key + 1);
      if (result.draft.status === "ready" || result.draft.status === "needs_review") {
        reviewReceiptDraft(result.draft);
      }
    } catch {
      // The mutation surfaces the actionable error and preserves the draft for retry.
    }
  };

  const clearForm = () => {
    setPaymentDate(today());
    setPayeeName("");
    setAmount("");
    setReferenceNumber("");
    setFundId("none");
    setMemo("");
    setReceiptFile(null);
    setSelectedReceiptDraftId(null);
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
      receipt_draft_id: selectedReceiptDraftId,
    });
    clearForm();
  };

  const handleVoid = (id: string, paymentNumber: string) => {
    const reason = window.prompt(`Reason for voiding ${paymentNumber}?`);
    if (!reason?.trim()) return;
    voidTransaction.mutate({ id, reason: reason.trim() });
  };

  const handleDismissReceipt = (draft: FinanceReceiptDraft) => {
    const reason = window.prompt(`Why should ${draft.merchant_name || draft.document?.file_name || "this receipt"} be dismissed?`);
    if (!reason?.trim()) return;
    dismissReceipt.mutate({ draftId: draft.id, reason: reason.trim() });
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
            <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4" />Receipt intelligence</CardTitle>
            <CardDescription>
              Upload a receipt and the system reads it, detects exact duplicates, suggests the transaction and accounts, then waits for Finance to review it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-col gap-3 rounded-md border border-dashed p-4 md:flex-row md:items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="receipt-scan">Receipt image or PDF</Label>
                <Input
                  key={scanInputKey}
                  id="receipt-scan"
                  type="file"
                  accept="image/*,application/pdf"
                  disabled={!selectedNgoId || analyzeReceipt.isPending}
                  onChange={(event) => setScanFile(event.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-muted-foreground">
                  {scanFile ? `${scanFile.name} · ${(scanFile.size / 1024 / 1024).toFixed(2)} MB` : "The receipt stays private in the selected NGO’s finance folder. Maximum 15 MB."}
                </p>
              </div>
              <Button type="button" disabled={!selectedNgoId || !scanFile || analyzeReceipt.isPending} onClick={handleAnalyzeReceipt}>
                {analyzeReceipt.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSearch className="mr-2 h-4 w-4" />}
                {analyzeReceipt.isPending ? "Reading receipt…" : "Analyze receipt"}
              </Button>
            </div>

            {receiptDraftsLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : !receiptDrafts.length ? (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                No analyzed receipts for this NGO yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                      <th className="p-3">Receipt</th><th className="p-3">Status</th><th className="p-3">Date</th>
                      <th className="p-3">Suggested account</th><th className="p-3">Confidence</th>
                      <th className="p-3 text-right">Total</th><th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receiptDrafts.map((draft) => {
                      const canReview = draft.status === "ready" || draft.status === "needs_review" || draft.status === "failed";
                      return (
                        <tr key={draft.id} className="border-b last:border-0">
                          <td className="p-3">
                            <p className="font-medium">{draft.merchant_name || draft.document?.file_name || "Unread receipt"}</p>
                            <p className="max-w-56 truncate text-xs text-muted-foreground">{draft.memo || draft.error_message || "Awaiting transaction details"}</p>
                          </td>
                          <td className="p-3">
                            <Badge variant={draft.status === "ready" || draft.status === "posted" ? "default" : draft.status === "failed" ? "destructive" : "secondary"}>
                              {(draft.status === "queued" || draft.status === "processing") && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                              {draft.status.replace("_", " ")}
                            </Badge>
                            {!!draft.needs_review_reasons?.length && (
                              <p className="mt-1 flex max-w-64 items-start gap-1 text-xs text-amber-700">
                                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{draft.needs_review_reasons[0]}
                              </p>
                            )}
                          </td>
                          <td className="p-3">{draft.transaction_date || "—"}</td>
                          <td className="p-3">{accountMap.get(draft.suggested_expense_account_id || "")?.name || "Needs selection"}</td>
                          <td className="p-3">{draft.confidence === null ? "—" : `${Math.round(draft.confidence * 100)}%`}</td>
                          <td className="p-3 text-right font-medium">{draft.total_amount === null ? "—" : money(draft.total_amount)}</td>
                          <td className="p-3 text-right">
                            {draft.status === "failed" ? (
                              <div className="flex justify-end gap-1">
                                <Button variant="outline" size="sm" disabled={retryReceipt.isPending} onClick={() => retryReceipt.mutate(draft.id)}>
                                  <RotateCcw className="mr-1 h-3 w-3" />Retry
                                </Button>
                                <Button variant="ghost" size="sm" disabled={dismissReceipt.isPending} onClick={() => handleDismissReceipt(draft)}>Dismiss</Button>
                              </div>
                            ) : canReview ? (
                              <div className="flex justify-end gap-1">
                                <Button variant="outline" size="sm" onClick={() => reviewReceiptDraft(draft)}>Review</Button>
                                <Button variant="ghost" size="sm" disabled={dismissReceipt.isPending} onClick={() => handleDismissReceipt(draft)}>Dismiss</Button>
                              </div>
                            ) : draft.status === "posted" ? (
                              <Badge variant="outline"><CheckCircle2 className="mr-1 h-3 w-3" />Posted</Badge>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card id="expense-transaction-form">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><WalletCards className="h-4 w-4" />New expense transaction</CardTitle>
            <CardDescription>
              One submission creates the payment record, attaches the receipt, posts both sides of the journal entry, and updates reports immediately.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedReceiptDraftId && (
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">
                <span className="flex items-center gap-2"><Receipt className="h-4 w-4 text-emerald-700" />An analyzed receipt is attached. Confirm every field before posting.</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedReceiptDraftId(null)}>Detach draft</Button>
              </div>
            )}
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
                      disabled={Boolean(selectedReceiptDraftId)}
                      onChange={(event) => setReceiptFile(event.target.files?.[0] ?? null)}
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      {selectedReceiptDraftId
                        ? "Using the private receipt from the analyzed draft above."
                        : receiptFile
                          ? `${receiptFile.name} · ${(receiptFile.size / 1024 / 1024).toFixed(2)} MB`
                          : "PDF or image, up to 15 MB. Missing receipts remain visible in the receipt report."}
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
                  {selectedReceiptDraftId ? "Review & post transaction" : "Post transaction"}
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
