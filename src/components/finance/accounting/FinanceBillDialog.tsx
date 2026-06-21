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
import { Plus, Trash2 } from "lucide-react";
import type { FinanceAccount } from "@/types/financeAccounting";
import type { FinanceBill, FinanceBillInput, FinanceBillLineInput, FinanceFund, FinanceVendor } from "@/types/financeAccounting";

type ReferenceData = {
  ngos: { id: string; legal_name: string; common_name: string | null }[];
  departments: { id: string; department_name: string }[];
  documents: { id: string; file_name: string }[];
};

const emptyLine = (): FinanceBillLineInput => ({
  expense_account_id: "",
  amount: 0,
  memo: "",
});

interface FinanceBillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill?: FinanceBill | null;
  readOnly?: boolean;
  vendors: FinanceVendor[];
  expenseAccounts: FinanceAccount[];
  funds: FinanceFund[];
  referenceData?: ReferenceData;
  onSave: (input: FinanceBillInput) => Promise<void>;
  isSaving?: boolean;
}

const formatMoney = (value: number) =>
  value.toLocaleString(undefined, { style: "currency", currency: "USD" });

export function FinanceBillDialog({
  open,
  onOpenChange,
  bill,
  readOnly = false,
  vendors,
  expenseAccounts,
  funds,
  referenceData,
  onSave,
  isSaving,
}: FinanceBillDialogProps) {
  const [vendorId, setVendorId] = useState("none");
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [terms, setTerms] = useState("");
  const [memo, setMemo] = useState("");
  const [documentId, setDocumentId] = useState("none");
  const [lines, setLines] = useState<FinanceBillLineInput[]>([emptyLine()]);

  useEffect(() => {
    if (!open) return;
    if (bill) {
      setVendorId(bill.vendor_id);
      setBillDate(bill.bill_date);
      setDueDate(bill.due_date || "");
      setTerms(bill.terms || "");
      setMemo(bill.memo || "");
      setDocumentId(bill.document_id || "none");
      setLines(
        bill.lines && bill.lines.length > 0
          ? bill.lines.map((line) => ({
              id: line.id,
              expense_account_id: line.expense_account_id,
              amount: Number(line.amount),
              memo: line.memo || "",
              fund_id: line.fund_id,
              ngo_id: line.ngo_id,
              department_id: line.department_id,
              grant_application_id: line.grant_application_id,
              line_number: line.line_number,
            }))
          : [emptyLine()]
      );
    } else {
      setVendorId(vendors[0]?.id ?? "none");
      setBillDate(new Date().toISOString().slice(0, 10));
      setDueDate("");
      setTerms("");
      setMemo("");
      setDocumentId("none");
      setLines([emptyLine()]);
    }
  }, [open, bill, vendors]);

  const total = useMemo(
    () => lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0),
    [lines]
  );

  const ref = referenceData ?? { ngos: [], departments: [], documents: [] };

  const updateLine = (index: number, patch: Partial<FinanceBillLineInput>) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const handleSubmit = async () => {
    if (vendorId === "none") return;
    await onSave({
      vendor_id: vendorId,
      bill_date: billDate,
      due_date: dueDate || null,
      terms: terms.trim() || null,
      memo: memo.trim() || null,
      document_id: documentId === "none" ? null : documentId,
      lines,
    });
    onOpenChange(false);
  };

  const title = readOnly
    ? `Bill ${bill?.bill_number ?? ""}`
    : bill
      ? `Edit ${bill.bill_number}`
      : "New bill";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Vendor *</Label>
              <Select value={vendorId} onValueChange={setVendorId} disabled={readOnly}>
                <SelectTrigger>
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select vendor</SelectItem>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bill-date">Bill date</Label>
              <Input id="bill-date" type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} disabled={readOnly} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due-date">Due date</Label>
              <Input id="due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={readOnly} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="terms">Terms</Label>
              <Input id="terms" value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Net 30" disabled={readOnly} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bill-memo">Memo</Label>
            <Textarea id="bill-memo" value={memo} onChange={(e) => setMemo(e.target.value)} disabled={readOnly} rows={2} />
          </div>

          <div className="space-y-2">
            <Label>Supporting document</Label>
            <Select value={documentId} onValueChange={setDocumentId} disabled={readOnly}>
              <SelectTrigger>
                <SelectValue placeholder="Optional attachment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No document</SelectItem>
                {ref.documents.map((doc) => (
                  <SelectItem key={doc.id} value={doc.id}>
                    {doc.file_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Expense lines</Label>
              {!readOnly && (
                <Button type="button" variant="outline" size="sm" onClick={() => setLines((prev) => [...prev, emptyLine()])}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add line
                </Button>
              )}
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                    <th className="p-2 min-w-[180px]">Expense account</th>
                    <th className="p-2 w-28">Amount</th>
                    <th className="p-2 min-w-[100px]">Fund</th>
                    <th className="p-2 min-w-[100px]">NGO</th>
                    <th className="p-2 min-w-[100px]">Dept</th>
                    <th className="p-2 min-w-[80px]">Memo</th>
                    {!readOnly && <th className="p-2 w-10" />}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={line.id ?? index} className="border-b">
                      <td className="p-2">
                        <Select
                          value={line.expense_account_id || "none"}
                          onValueChange={(v) => updateLine(index, { expense_account_id: v === "none" ? "" : v })}
                          disabled={readOnly}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Account" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Select account</SelectItem>
                            {expenseAccounts.map((account) => (
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
                          value={line.amount || ""}
                          onChange={(e) => updateLine(index, { amount: Number(e.target.value) || 0 })}
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
                          <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            {funds.map((fund) => (
                              <SelectItem key={fund.id} value={fund.id}>{fund.name}</SelectItem>
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
                          <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            {ref.ngos.map((ngo) => (
                              <SelectItem key={ngo.id} value={ngo.id}>{ngo.common_name || ngo.legal_name}</SelectItem>
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
                          <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            {ref.departments.map((dept) => (
                              <SelectItem key={dept.id} value={dept.id}>{dept.department_name}</SelectItem>
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
                        />
                      </td>
                      {!readOnly && (
                        <td className="p-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-destructive"
                            onClick={() => setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))}
                            disabled={lines.length <= 1}
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
                    <td className="p-2 text-right">Total</td>
                    <td className="p-2" colSpan={readOnly ? 5 : 6}>{formatMoney(total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            {readOnly ? "Close" : "Cancel"}
          </Button>
          {!readOnly && (
            <Button onClick={handleSubmit} disabled={vendorId === "none" || total <= 0 || isSaving}>
              {bill ? "Save bill" : "Create bill"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
