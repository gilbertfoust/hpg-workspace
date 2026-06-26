import { useEffect, useMemo, useRef, useState } from "react";
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
import { Plus, Trash2, AlertTriangle, Upload, Paperclip, X, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { FinanceAccount } from "@/types/financeAccounting";
import type { FinanceFund } from "@/types/financeAccounting";
import type {
  FinanceJournalEntryWithLines,
  FinanceJournalLineInput,
  FinanceJournalEntrySavePayload,
} from "@/types/financeAccounting";
import { computeJournalTotals } from "@/types/financeAccounting";
import type { FinanceFiscalPeriod } from "@/types/financeAccounting";
import {
  useFinanceDocumentLinks,
  useUnlinkFinanceDocument,
} from "@/hooks/useFinanceDocumentLinks";

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
  fiscalPeriods?: FinanceFiscalPeriod[];
  referenceData?: ReferenceData;
  onSave: (payload: FinanceJournalEntrySavePayload) => Promise<void>;
  isSaving?: boolean;
}

const formatMoney = (value: number) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** HTML date inputs require yyyy-MM-dd; DB values may include timestamps. */
const toDateInputValue = (value?: string | null) => {
  if (!value) return "";
  const normalized = value.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
};

const findOpenPeriodForDate = (periods: FinanceFiscalPeriod[], date: string) => {
  if (!date) return null;
  return (
    periods.find(
      (period) =>
        period.status === "open" &&
        date >= toDateInputValue(period.start_date) &&
        date <= toDateInputValue(period.end_date),
    ) ?? null
  );
};

export function FinanceJournalEntryDialog({
  open,
  onOpenChange,
  entry,
  readOnly = false,
  accounts,
  funds,
  fiscalPeriods = [],
  referenceData,
  onSave,
  isSaving,
}: FinanceJournalEntryDialogProps) {
  const [entryDate, setEntryDate] = useState(() => toDateInputValue(new Date().toISOString()) || new Date().toISOString().slice(0, 10));
  const [fiscalPeriodId, setFiscalPeriodId] = useState<string>("");
  const [memo, setMemo] = useState("");
  const [lines, setLines] = useState<FinanceJournalLineInput[]>([emptyLine(), emptyLine()]);
  const [selectedDocumentId, setSelectedDocumentId] = useState("none");
  const [pendingReceiptFile, setPendingReceiptFile] = useState<File | null>(null);
  const [receiptLinkNotes, setReceiptLinkNotes] = useState("");
  const receiptFileInputRef = useRef<HTMLInputElement>(null);

  const entryId = entry?.id ?? null;
  const { data: linkedDocuments = [], isLoading: linksLoading } = useFinanceDocumentLinks(
    "journal_entry",
    entryId,
  );
  const unlinkDocument = useUnlinkFinanceDocument();

  useEffect(() => {
    if (!open) return;
    if (entry) {
      const normalizedDate = toDateInputValue(entry.entry_date);
      setEntryDate(normalizedDate);
      setFiscalPeriodId(entry.fiscal_period_id || "");
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
      const today = toDateInputValue(new Date().toISOString()) || new Date().toISOString().slice(0, 10);
      setEntryDate(today);
      const matchedPeriod = findOpenPeriodForDate(fiscalPeriods, today);
      setFiscalPeriodId(matchedPeriod?.id || "");
      setMemo("");
      setLines([emptyLine(), emptyLine()]);
      setSelectedDocumentId("none");
      setPendingReceiptFile(null);
      setReceiptLinkNotes("");
    }
  }, [open, entry, fiscalPeriods]);

  const handleEntryDateChange = (value: string) => {
    setEntryDate(value);
    if (!value) return;
    const matchedPeriod = findOpenPeriodForDate(fiscalPeriods, value);
    if (matchedPeriod) {
      setFiscalPeriodId(matchedPeriod.id);
    }
  };

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
    if (!entryDate) return;

    const hasReceiptAttachment =
      Boolean(pendingReceiptFile) || (selectedDocumentId !== "none" && selectedDocumentId);

    await onSave({
      input: {
        entry_date: entryDate,
        memo: memo.trim() || null,
        fiscal_period_id: fiscalPeriodId || null,
        lines,
      },
      receipt: hasReceiptAttachment
        ? {
            existingDocumentId: selectedDocumentId !== "none" ? selectedDocumentId : null,
            file: pendingReceiptFile,
            linkNotes: receiptLinkNotes.trim() || null,
          }
        : null,
    });
    onOpenChange(false);
  };

  const handleReceiptFileChange = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setPendingReceiptFile(file);
    setSelectedDocumentId("none");
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="je-date">Transaction date</Label>
              <Input
                id="je-date"
                type="date"
                value={entryDate}
                onChange={(e) => handleEntryDateChange(e.target.value)}
                disabled={readOnly}
                required
              />
            </div>
            {fiscalPeriods.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="je-period">Fiscal period</Label>
                <Select
                  value={fiscalPeriodId || "none"}
                  onValueChange={(value) => setFiscalPeriodId(value === "none" ? "" : value)}
                  disabled={readOnly}
                >
                  <SelectTrigger id="je-period">
                    <SelectValue placeholder="Auto from date" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Auto from date</SelectItem>
                    {fiscalPeriods.map((period) => (
                      <SelectItem key={period.id} value={period.id}>
                        {period.label} ({period.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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

          <div className="rounded-md border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Receipt / supporting document</Label>
            </div>

            {linksLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading attachments...
              </div>
            ) : linkedDocuments.length > 0 ? (
              <div className="space-y-2">
                {linkedDocuments.map((link) => (
                  <div
                    key={link.id}
                    className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{link.document?.file_name || "Document"}</p>
                      {link.link_notes && (
                        <p className="text-xs text-muted-foreground truncate">{link.link_notes}</p>
                      )}
                    </div>
                    {!readOnly && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-destructive"
                        onClick={() => unlinkDocument.mutate(link.id)}
                        disabled={unlinkDocument.isPending}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No receipt attached yet.</p>
            )}

            {!readOnly && (
              <div className="space-y-3 pt-1">
                <input
                  ref={receiptFileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.heic"
                  onChange={(e) => handleReceiptFileChange(e.target.files)}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => receiptFileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    Upload receipt
                  </Button>
                  {pendingReceiptFile && (
                    <Badge variant="secondary" className="gap-1 pr-1">
                      {pendingReceiptFile.name}
                      <button
                        type="button"
                        className="ml-1 rounded-full hover:bg-muted"
                        onClick={() => setPendingReceiptFile(null)}
                        aria-label="Remove selected file"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Or link an existing document</Label>
                  <Select
                    value={selectedDocumentId}
                    onValueChange={(value) => {
                      setSelectedDocumentId(value);
                      if (value !== "none") setPendingReceiptFile(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select document" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No document selected</SelectItem>
                      {ref.documents.map((doc) => (
                        <SelectItem key={doc.id} value={doc.id}>
                          {doc.file_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {(pendingReceiptFile || selectedDocumentId !== "none") && (
                  <div className="space-y-2">
                    <Label htmlFor="receipt-notes" className="text-xs text-muted-foreground">
                      Attachment notes (optional)
                    </Label>
                    <Input
                      id="receipt-notes"
                      value={receiptLinkNotes}
                      onChange={(e) => setReceiptLinkNotes(e.target.value)}
                      placeholder="Vendor, invoice #, etc."
                    />
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Receipts are saved when you create or update the journal entry draft.
                </p>
              </div>
            )}
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
