import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AccountSelector } from "@/components/finance/AccountSelector";
import { Account } from "@/hooks/useAccounts";
import { Plus, Trash2 } from "lucide-react";

export interface JournalLine {
  accountId: string;
  debit: number;
  credit: number;
  memo: string;
}

interface Props {
  accounts: Account[];
  lines: JournalLine[];
  onChange: (lines: JournalLine[]) => void;
}

export function TransactionAutoBuilder({ accounts, lines, onChange }: Props) {
  const addLine = () => {
    onChange([...lines, { accountId: "", debit: 0, credit: 0, memo: "" }]);
  };

  const removeLine = (idx: number) => {
    onChange(lines.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, field: keyof JournalLine, value: string | number) => {
    const updated = lines.map((l, i) =>
      i === idx ? { ...l, [field]: value } : l
    );
    onChange(updated);
  };

  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Journal Entry Lines</Label>
        <Button variant="outline" size="sm" onClick={addLine}>
          <Plus className="w-3 h-3 mr-1" /> Add Line
        </Button>
      </div>
      {lines.map((line, idx) => (
        <div key={idx} className="grid grid-cols-[1fr_100px_100px_auto] gap-2 items-end">
          <div>
            <Label className="text-xs">Account</Label>
            <AccountSelector
              accounts={accounts}
              value={line.accountId}
              onValueChange={(v) => updateLine(idx, "accountId", v)}
              placeholder="Select account"
            />
          </div>
          <div>
            <Label className="text-xs">Debit</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={line.debit || ""}
              onChange={(e) => updateLine(idx, "debit", parseFloat(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label className="text-xs">Credit</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={line.credit || ""}
              onChange={(e) => updateLine(idx, "credit", parseFloat(e.target.value) || 0)}
            />
          </div>
          <Button variant="ghost" size="icon" onClick={() => removeLine(idx)}>
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      ))}
      <div className="flex justify-end gap-4 text-sm pt-2 border-t">
        <span>Debits: <strong>${totalDebit.toFixed(2)}</strong></span>
        <span>Credits: <strong>${totalCredit.toFixed(2)}</strong></span>
        {!isBalanced && lines.length > 0 && (
          <span className="text-destructive font-medium">Unbalanced!</span>
        )}
      </div>
    </div>
  );
}
