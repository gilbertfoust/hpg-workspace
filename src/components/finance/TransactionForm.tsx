import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AccountSelector } from "./AccountSelector";
import { Account } from "@/hooks/useAccounts";
import { JournalEntryInput } from "@/hooks/useTransactions";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TransactionFormProps {
  accounts: Account[];
  onSubmit: (data: { transaction_date: string; description: string; reference_number: string; entries: JournalEntryInput[] }) => void;
  submitting?: boolean;
}

const emptyLine = (): JournalEntryInput & { _key: number } => ({
  _key: Date.now() + Math.random(),
  account_id: "",
  debit: 0,
  credit: 0,
  memo: "",
});

export function TransactionForm({ accounts, onSubmit, submitting }: TransactionFormProps) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [refNumber, setRefNumber] = useState("");
  const [lines, setLines] = useState([emptyLine(), emptyLine()]);

  const totalDebit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.005 && totalDebit > 0;

  const updateLine = (idx: number, field: string, value: any) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  };

  const removeLine = (idx: number) => {
    if (lines.length <= 2) return;
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = () => {
    if (!isBalanced || !description || !date) return;
    onSubmit({
      transaction_date: date,
      description,
      reference_number: refNumber,
      entries: lines.map(({ account_id, debit, credit, memo }) => ({ account_id, debit: Number(debit), credit: Number(credit), memo })),
    });
  };

  return (
    <Card>
      <CardHeader><CardTitle>New Transaction</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Transaction description" />
          </div>
          <div>
            <Label>Reference #</Label>
            <Input value={refNumber} onChange={(e) => setRefNumber(e.target.value)} placeholder="Optional" />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-base font-semibold">Journal Lines</Label>
            <Button variant="outline" size="sm" onClick={() => setLines([...lines, emptyLine()])}>
              <Plus className="h-4 w-4 mr-1" /> Add Line
            </Button>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <div className="grid grid-cols-[1fr_120px_120px_1fr_40px] gap-2 bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
              <span>Account</span><span className="text-right">Debit</span><span className="text-right">Credit</span><span>Memo</span><span />
            </div>
            {lines.map((line, idx) => (
              <div key={(line as any)._key} className="grid grid-cols-[1fr_120px_120px_1fr_40px] gap-2 px-3 py-2 border-t items-center">
                <AccountSelector accounts={accounts} value={line.account_id} onValueChange={(v) => updateLine(idx, "account_id", v)} placeholder="Account" />
                <Input type="number" min={0} step="0.01" value={line.debit || ""} onChange={(e) => updateLine(idx, "debit", e.target.value)} className="text-right" placeholder="0.00" />
                <Input type="number" min={0} step="0.01" value={line.credit || ""} onChange={(e) => updateLine(idx, "credit", e.target.value)} className="text-right" placeholder="0.00" />
                <Input value={line.memo || ""} onChange={(e) => updateLine(idx, "memo", e.target.value)} placeholder="Memo" />
                <Button variant="ghost" size="icon" onClick={() => removeLine(idx)} disabled={lines.length <= 2}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
              </div>
            ))}
            <div className="grid grid-cols-[1fr_120px_120px_1fr_40px] gap-2 px-3 py-2 border-t bg-muted font-semibold text-sm">
              <span>Totals</span>
              <span className="text-right">{totalDebit.toFixed(2)}</span>
              <span className="text-right">{totalCredit.toFixed(2)}</span>
              <span className={isBalanced ? "text-green-600" : "text-destructive"}>{isBalanced ? "✓ Balanced" : `Difference: ${Math.abs(totalDebit - totalCredit).toFixed(2)}`}</span>
              <span />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button onClick={handleSubmit} disabled={!isBalanced || !description || submitting}>
            {submitting ? "Saving…" : "Save Transaction"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
