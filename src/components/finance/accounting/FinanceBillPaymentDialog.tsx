import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FinanceBankAccount, FinanceBill } from "@/types/financeAccounting";

interface FinanceBillPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: FinanceBill | null;
  bankAccounts: FinanceBankAccount[];
  onPay: (input: { amount: number; bankAccountId: string; paymentDate: string; memo?: string }) => Promise<void>;
  isPaying?: boolean;
}

const formatMoney = (value: number) =>
  value.toLocaleString(undefined, { style: "currency", currency: "USD" });

export function FinanceBillPaymentDialog({
  open,
  onOpenChange,
  bill,
  bankAccounts,
  onPay,
  isPaying,
}: FinanceBillPaymentDialogProps) {
  const balanceDue = bill?.balance_due ?? 0;
  const [amount, setAmount] = useState("");
  const [bankAccountId, setBankAccountId] = useState("none");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState("");

  useEffect(() => {
    if (!open || !bill) return;
    setAmount(String(balanceDue));
    setBankAccountId(bankAccounts[0]?.id ?? "none");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setMemo(`Payment for ${bill.bill_number}`);
  }, [open, bill, balanceDue, bankAccounts]);

  const paymentAmount = Number(amount) || 0;
  const overBalance = paymentAmount > balanceDue + 0.001;

  const handleSubmit = async () => {
    if (!bill || bankAccountId === "none" || paymentAmount <= 0 || overBalance) return;
    await onPay({
      amount: paymentAmount,
      bankAccountId,
      paymentDate,
      memo: memo.trim() || undefined,
    });
    onOpenChange(false);
  };

  if (!bill) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pay bill {bill.bill_number}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Balance due: <span className="font-medium text-foreground">{formatMoney(balanceDue)}</span>
          {" · "}
          Vendor: {bill.vendor?.name}
        </p>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="payment-amount">Payment amount</Label>
            <Input
              id="payment-amount"
              type="number"
              min={0}
              max={balanceDue}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {overBalance && (
              <p className="text-xs text-destructive">Payment cannot exceed balance due.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Bank account</Label>
            <Select value={bankAccountId} onValueChange={setBankAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select bank account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select bank account</SelectItem>
                {bankAccounts.map((bank) => (
                  <SelectItem key={bank.id} value={bank.id}>
                    {bank.account_name}
                    {bank.last_four ? ` ••••${bank.last_four}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment-date">Payment date</Label>
            <Input id="payment-date" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment-memo">Memo</Label>
            <Textarea id="payment-memo" value={memo} onChange={(e) => setMemo(e.target.value)} rows={2} />
          </div>
          <p className="text-xs text-muted-foreground">
            Posts journal entry: debit Accounts Payable, credit linked bank/cash GL account.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPaying}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPaying || bankAccountId === "none" || paymentAmount <= 0 || overBalance}
          >
            Record payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
