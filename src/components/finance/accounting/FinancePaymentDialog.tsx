import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FinanceAccount, FinanceBankAccount, FinanceBill, FinanceFund, FinancePayment, FinancePaymentInput, FinancePaymentType } from "@/types/financeAccounting";
import { FINANCE_PAYMENT_TYPE_LABELS } from "@/types/financeAccounting";

interface FinancePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment?: FinancePayment | null;
  readOnly?: boolean;
  bankAccounts: FinanceBankAccount[];
  expenseAccounts: FinanceAccount[];
  funds: FinanceFund[];
  openBills: FinanceBill[];
  ngos: { id: string; legal_name: string; common_name: string | null }[];
  grants: { id: string; title: string }[];
  onSave: (input: FinancePaymentInput) => Promise<void>;
  isSaving?: boolean;
}

export function FinancePaymentDialog({
  open, onOpenChange, payment, readOnly = false, bankAccounts, expenseAccounts, funds,
  openBills, ngos, grants, onSave, isSaving,
}: FinancePaymentDialogProps) {
  const [paymentType, setPaymentType] = useState<FinancePaymentType>("reimbursement");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [bankAccountId, setBankAccountId] = useState("none");
  const [targetBankAccountId, setTargetBankAccountId] = useState("none");
  const [billId, setBillId] = useState("none");
  const [payeeName, setPayeeName] = useState("");
  const [ngoId, setNgoId] = useState("none");
  const [fundId, setFundId] = useState("none");
  const [grantId, setGrantId] = useState("none");
  const [expenseAccountId, setExpenseAccountId] = useState("none");
  const [memo, setMemo] = useState("");
  const [approvalNotes, setApprovalNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    if (payment) {
      setPaymentType(payment.payment_type);
      setPaymentDate(payment.payment_date);
      setAmount(String(payment.amount));
      setBankAccountId(payment.bank_account_id || "none");
      setTargetBankAccountId(payment.target_bank_account_id || "none");
      setBillId(payment.bill_id || "none");
      setPayeeName(payment.payee_name || "");
      setNgoId(payment.ngo_id || "none");
      setFundId(payment.fund_id || "none");
      setGrantId(payment.grant_application_id || "none");
      setExpenseAccountId(payment.expense_account_id || "none");
      setMemo(payment.memo || "");
      setApprovalNotes(payment.approval_notes || "");
    } else {
      setPaymentType("reimbursement");
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setAmount("");
      setBankAccountId(bankAccounts[0]?.id ?? "none");
      setTargetBankAccountId("none");
      setBillId("none");
      setPayeeName("");
      setNgoId("none");
      setFundId("none");
      setGrantId("none");
      setExpenseAccountId("none");
      setMemo("");
      setApprovalNotes("");
    }
  }, [open, payment, bankAccounts]);

  const handleSubmit = async () => {
    await onSave({
      payment_type: paymentType,
      payment_date: paymentDate,
      amount: Number(amount) || 0,
      bank_account_id: bankAccountId === "none" ? null : bankAccountId,
      target_bank_account_id: targetBankAccountId === "none" ? null : targetBankAccountId,
      bill_id: billId === "none" ? null : billId,
      payee_name: payeeName.trim() || null,
      ngo_id: ngoId === "none" ? null : ngoId,
      fund_id: fundId === "none" ? null : fundId,
      grant_application_id: grantId === "none" ? null : grantId,
      expense_account_id: expenseAccountId === "none" ? null : expenseAccountId,
      memo: memo.trim() || null,
      approval_notes: approvalNotes.trim() || null,
    });
    onOpenChange(false);
  };

  const needsNgo = paymentType === "ngo_disbursement" || paymentType === "grant_pass_through";
  const needsExpense = paymentType === "reimbursement";
  const needsBill = paymentType === "vendor_bill";
  const needsTargetBank = paymentType === "internal_transfer";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{readOnly ? `Payment ${payment?.payment_number}` : payment ? "Edit payment" : "New payment / disbursement"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label>Payment type</Label>
            <Select value={paymentType} onValueChange={(v) => setPaymentType(v as FinancePaymentType)} disabled={readOnly || !!payment}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(FINANCE_PAYMENT_TYPE_LABELS) as FinancePaymentType[]).map((t) => (
                  <SelectItem key={t} value={t}>{FINANCE_PAYMENT_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Payment date</Label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} disabled={readOnly} />
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={readOnly} />
            </div>
          </div>
          {needsBill && (
            <div className="space-y-2">
              <Label>Bill</Label>
              <Select value={billId} onValueChange={setBillId} disabled={readOnly}>
                <SelectTrigger><SelectValue placeholder="Select bill" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select bill</SelectItem>
                  {openBills.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.bill_number} — balance {b.balance_due?.toFixed(2)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {needsExpense && (
            <div className="space-y-2">
              <Label>Expense account</Label>
              <Select value={expenseAccountId} onValueChange={setExpenseAccountId} disabled={readOnly}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select account</SelectItem>
                  {expenseAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {needsNgo && (
            <>
              <div className="space-y-2">
                <Label>Sponsored NGO *</Label>
                <Select value={ngoId} onValueChange={setNgoId} disabled={readOnly}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select NGO</SelectItem>
                    {ngos.map((n) => (
                      <SelectItem key={n.id} value={n.id}>{n.common_name || n.legal_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {paymentType === "grant_pass_through" && (
                <div className="space-y-2">
                  <Label>Grant application</Label>
                  <Select value={grantId} onValueChange={setGrantId} disabled={readOnly}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Optional</SelectItem>
                      {grants.map((g) => (
                        <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
          <div className="space-y-2">
            <Label>{needsTargetBank ? "From bank account" : "Bank account"}</Label>
            <Select value={bankAccountId} onValueChange={setBankAccountId} disabled={readOnly}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select bank</SelectItem>
                {bankAccounts.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.account_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {needsTargetBank && (
            <div className="space-y-2">
              <Label>To bank account</Label>
              <Select value={targetBankAccountId} onValueChange={setTargetBankAccountId} disabled={readOnly}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select bank</SelectItem>
                  {bankAccounts.filter((b) => b.id !== bankAccountId).map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.account_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Fund</Label>
            <Select value={fundId} onValueChange={setFundId} disabled={readOnly}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {funds.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Payee name</Label>
            <Input value={payeeName} onChange={(e) => setPayeeName(e.target.value)} disabled={readOnly} />
          </div>
          <div className="space-y-2">
            <Label>Memo</Label>
            <Textarea value={memo} onChange={(e) => setMemo(e.target.value)} disabled={readOnly} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Approval / documentation notes</Label>
            <Textarea value={approvalNotes} onChange={(e) => setApprovalNotes(e.target.value)} disabled={readOnly} rows={2} placeholder="Required for fiscal sponsorship disbursements" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{readOnly ? "Close" : "Cancel"}</Button>
          {!readOnly && (
            <Button onClick={handleSubmit} disabled={isSaving || !amount || Number(amount) <= 0}>Save draft</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
