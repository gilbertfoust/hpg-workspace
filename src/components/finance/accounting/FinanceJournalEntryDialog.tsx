import { useEffect, useMemo, useState } from "react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import type { FinanceAccount } from "@/types/financeAccounting";
import type { FinanceFund } from "@/types/financeAccounting";
import type {
  FinanceJournalEntryWithLines,
  FinanceJournalLineInput,
} from "@/types/financeAccounting";
import { computeJournalTotals } from "@/types/financeAccounting";
import type { FinanceJournalEntryInput } from "@/types/financeAccounting";

type ReferenceData = {
  ngos: { id: string; legal_name: string; common_name: string | null }[];
  departments: { id: string; department_name: string }[];
  grants: { id: string; title: string; stage: string | null }[];
  workItems: { id: string; title: string; status: string | null }[];
  documents: { id: string; file_name: string }[];
};

const emptyLine = (): FinanceJournalLineInput => ({
  account_id: "",
  debit: 0,
  credit: 0,
  memo: "",
});

interface FinanceJournalEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: FinanceJournalEntryWithLines | null;
  readOnly?: boolean;
  accounts: FinanceAccount[];
  funds: FinanceFund[];
  referenceData?: ReferenceData;
  onSave: (input: FinanceJournalEntryInput) => Promise<void>;
  isSaving?: boolean;
}

const formatMoney = (value: number) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function FinanceJournalEntryDialog({
  open,
  onOpenChange,
  entry,
  readOnly = false,
  accounts,
  funds,
  referenceData,
  onSave,
  isSaving,
}: FinanceJournalEntryDialogProps) {
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState("");
  const [lines, setLines] = useState<FinanceJournalLineInput[]>([emptyLine(), emptyLine()]);

  useEffect(() => {
    if (!open) return;
    if (entry) {
      setEntryDate(entry.entry_date);
      setMemo(entry.memo || "");
      setLines(
        entry.lines.length > 0
          ? entry.lines.map((line) => ({
              id: line.id,
              account_id: line.account_id,
              debit: Number(line.debit),
              credit: Number(line.credit),
              memo: line.memo || "",
              fund_id: line.fund_id,
              ngo_id: line.ngo_id,
              department_id: line.department_id,
              dimension_id: line.dimension_id,
              document_id: line.document_id,
              grant_application_id: line.grant_application_id,
              work_item_id: line.work_item_id,
              line_number: line.line_number,
            }))
          : [emptyLine(), emptyLine()]
      );
    } else {
      setEntryDate(new Date().toISOString().slice(0, 10));
      setMemo("");
      setLines([emptyLine(), emptyLine()]);
    }
  }, [open, entry]);

  const totals = useMemo(() => computeJournalTotals(lines), [lines]);
  const accountOptions = useMemo(
    () => [...accounts].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })),
    [accounts]
  );

  const updateLine = (index: number, patch: Partial<FinanceJournalLineInput>) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);

  const removeLine = (index: number) => {
    setLines((prev) => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== index)));
  };

  const handleAmountChange = (index: number, side: "debit" | "credit", raw: string) => {
    const value = raw === "" ? 0 : Math.max(0, Number(raw));
    if (side === "debit") {
      updateLine(index, { debit: value, credit: value > 0 ? 0 : lines[index]?.credit ?? 0 });
    } else {
      updateLine(index, { credit: value, debit: value > 0 ? 0 : lines[index]?.debit ?? 0 });
    }
  };

  const handleSubmit = async () => {
    await onSave({
      entry_date: entryDate,
      memo: memo.trim() || null,
      lines,
    });
    onOpenChange(false);
  };

  const ref = referenceData ?? {
    ngos: [],
    departments: [],
    grants: [],
    workItems: [],
    documents: [],
  };

  const title = readOnly
    ? `Journal entry ${entry?.entry_number ?? ""}`
    : entry
      ? `Edit ${entry.entry_number}`
      : "New journal entry";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="je-date">Entry date</Label>
              <Input
                id="je-date"
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                disabled={readOnly}
              />
            </div>
            {entry && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Input value={entry.status} disabled className="capitalize" />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="je-memo">Memo</Label>
            <Textarea
              id="je-memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Describe this journal entry..."
              disabled={readOnly}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Journal lines</Label>
              {!readOnly && (
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add line
                </Button>
              )}
            </div>

            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                    <th className="p-2 min-w-[180px]">Account</th>
                    <th className="p-2 w-24">Debit</th>
                    <th className="p-2 w-24">Credit</th>
                    <th className="p-2 min-w-[120px]">Fund</th>
                    <th className="p-2 min-w-[120px]">NGO</th>
                    <th className="p-2 min-w-[120px]">Dept</th>
                    <th className="p-2 min-w-[100px]">Memo</th>
                    {!readOnly && <th className="p-2 w-10" />}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={line.id ?? index} className="border-b align-top">
                      <td className="p-2">
                        <Select
                          value={line.account_id || "none"}
                          onValueChange={(v) => updateLine(index, { account_id: v === "none" ? "" : v })}
                          disabled={readOnly}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Select account</SelectItem>
                            {accountOptions.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.code} — {account.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={line.debit || ""}
                          onChange={(e) => handleAmountChange(index, "debit", e.target.value)}
                          disabled={readOnly}
                          className="h-9"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={line.credit || ""}
                          onChange={(e) => handleAmountChange(index, "credit", e.target.value)}
                          disabled={readOnly}
                          className="h-9"
                        />
                      </td>
                      <td className="p-2">
                        <Select
                          value={line.fund_id || "none"}
                          onValueChange={(v) => updateLine(index, { fund_id: v === "none" ? null : v })}
                          disabled={readOnly}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            {funds.map((fund) => (
                              <SelectItem key={fund.id} value={fund.id}>
                                {fund.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2">
                        <Select
                          value={line.ngo_id || "none"}
                          onValueChange={(v) => updateLine(index, { ngo_id: v === "none" ? null : v })}
                          disabled={readOnly}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            {ref.ngos.map((ngo) => (
                              <SelectItem key={ngo.id} value={ngo.id}>
                                {ngo.common_name || ngo.legal_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2">
                        <Select
                          value={line.department_id || "none"}
                          onValueChange={(v) => updateLine(index, { department_id: v === "none" ? null : v })}
                          disabled={readOnly}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            {ref.departments.map((dept) => (
                              <SelectItem key={dept.id} value={dept.id}>
                                {dept.department_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2">
                        <Input
                          value={line.memo || ""}
                          onChange={(e) => updateLine(index, { memo: e.target.value })}
                          disabled={readOnly}
                          className="h-9"
                          placeholder="Line memo"
                        />
                      </td>
                      {!readOnly && (
                        <td className="p-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-destructive"
                            onClick={() => removeLine(index)}
                            disabled={lines.length <= 2}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30 font-medium">
                    <td className="p-2 text-right">Totals</td>
                    <td className="p-2">${formatMoney(totals.totalDebit)}</td>
                    <td className="p-2">${formatMoney(totals.totalCredit)}</td>
                    <td colSpan={readOnly ? 4 : 5} className="p-2">
                      {!totals.isBalanced && totals.totalDebit + totals.totalCredit > 0 && (
                        <span className="text-destructive text-xs inline-flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Out of balance by ${formatMoney(Math.abs(totals.difference))}
                        </span>
                      )}
                      {totals.isBalanced && totals.totalDebit > 0 && (
                        <span className="text-green-600 text-xs">Balanced</span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {!readOnly && !totals.isBalanced && totals.totalDebit + totals.totalCredit > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Debits and credits must balance before posting. Save as draft to finish later.
                </AlertDescription>
              </Alert>
            )}

            <details className="rounded-md border p-3 text-sm">
              <summary className="cursor-pointer font-medium">Advanced line links (grant, work item, document)</summary>
              <div className="mt-3 space-y-3">
                {lines.map((line, index) => (
                  <div key={`adv-${line.id ?? index}`} className="grid grid-cols-1 md:grid-cols-3 gap-2 pb-2 border-b last:border-0">
                    <span className="text-xs text-muted-foreground md:col-span-3">Line {index + 1}</span>
                    <Select
                      value={line.grant_application_id || "none"}
                      onValueChange={(v) =>
                        updateLine(index, { grant_application_id: v === "none" ? null : v })
                      }
                      disabled={readOnly}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Grant application" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No grant</SelectItem>
                        {ref.grants.map((grant) => (
                          <SelectItem key={grant.id} value={grant.id}>
                            {grant.title || grant.id.slice(0, 8)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={line.work_item_id || "none"}
                      onValueChange={(v) => updateLine(index, { work_item_id: v === "none" ? null : v })}
                      disabled={readOnly}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Work item" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No work item</SelectItem>
                        {ref.workItems.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={line.document_id || "none"}
                      onValueChange={(v) => updateLine(index, { document_id: v === "none" ? null : v })}
                      disabled={readOnly}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Document" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No document</SelectItem>
                        {ref.documents.map((doc) => (
                          <SelectItem key={doc.id} value={doc.id}>
                            {doc.file_name || doc.id.slice(0, 8)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </details>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            {readOnly ? "Close" : "Cancel"}
          </Button>
          {!readOnly && (
            <Button onClick={handleSubmit} disabled={isSaving || !entryDate}>
              {entry ? "Save draft" : "Create draft"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
