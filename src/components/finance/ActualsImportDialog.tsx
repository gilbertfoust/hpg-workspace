import { useState, useCallback, useRef } from "react";
import Papa from "papaparse";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useBudgetCategories } from "@/hooks/useBudgetCategories";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

interface ActualsImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ngoId: string;
  fiscalPeriodId: string;
}

interface ParsedRow {
  [key: string]: string;
}

interface MappedRow {
  categoryCode: string;
  categoryName: string;
  amount: number;
  matchedCategoryId: string | null;
  matchedCategoryName: string | null;
  status: "matched" | "unmatched" | "invalid";
}

const SKIP = "__skip__";

export function ActualsImportDialog({ open, onOpenChange, ngoId, fiscalPeriodId }: ActualsImportDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: categories } = useBudgetCategories(ngoId);

  const [step, setStep] = useState<"upload" | "map" | "preview" | "importing" | "done">("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");

  // Column mapping
  const [codeCol, setCodeCol] = useState(SKIP);
  const [nameCol, setNameCol] = useState(SKIP);
  const [amountCol, setAmountCol] = useState(SKIP);

  const [mappedRows, setMappedRows] = useState<MappedRow[]>([]);
  const [importResult, setImportResult] = useState<{ inserted: number; skipped: number }>({ inserted: 0, skipped: 0 });

  const reset = () => {
    setStep("upload");
    setHeaders([]);
    setRows([]);
    setFileName("");
    setCodeCol(SKIP);
    setNameCol(SKIP);
    setAmountCol(SKIP);
    setMappedRows([]);
    setImportResult({ inserted: 0, skipped: 0 });
  };

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (result.errors.length > 0) {
          toast({ variant: "destructive", title: "Parse error", description: result.errors[0].message });
          return;
        }
        const parsed = result.data as ParsedRow[];
        if (parsed.length === 0) {
          toast({ variant: "destructive", title: "Empty file", description: "No data rows found." });
          return;
        }
        setHeaders(result.meta.fields || Object.keys(parsed[0]));
        setRows(parsed);

        // Auto-detect columns
        const fields = result.meta.fields || Object.keys(parsed[0]);
        const lower = fields.map((f) => f.toLowerCase());
        const codeIdx = lower.findIndex((h) => h.includes("code") || h.includes("account") || h.includes("acct"));
        const nameIdx = lower.findIndex((h) => h.includes("category") || h.includes("name") || h.includes("description") || h.includes("desc"));
        const amountIdx = lower.findIndex((h) => h.includes("amount") || h.includes("actual") || h.includes("total") || h.includes("balance"));

        if (codeIdx >= 0) setCodeCol(fields[codeIdx]);
        if (nameIdx >= 0) setNameCol(fields[nameIdx]);
        if (amountIdx >= 0) setAmountCol(fields[amountIdx]);

        setStep("map");
      },
    });

    // Reset input so same file can be re-selected
    e.target.value = "";
  }, [toast]);

  const handleMapping = () => {
    if (amountCol === SKIP) {
      toast({ variant: "destructive", title: "Amount column required", description: "You must map the Amount column." });
      return;
    }
    if (codeCol === SKIP && nameCol === SKIP) {
      toast({ variant: "destructive", title: "Category mapping required", description: "Map at least the Category Code or Category Name column." });
      return;
    }

    const mapped: MappedRow[] = rows.map((row) => {
      const code = codeCol !== SKIP ? (row[codeCol] || "").trim() : "";
      const name = nameCol !== SKIP ? (row[nameCol] || "").trim() : "";
      const rawAmount = (row[amountCol] || "").replace(/[^0-9.\-]/g, "");
      const amount = parseFloat(rawAmount);

      if (isNaN(amount)) {
        return { categoryCode: code, categoryName: name, amount: 0, matchedCategoryId: null, matchedCategoryName: null, status: "invalid" as const };
      }

      // Try to match by code first, then name
      let match = categories?.find((c) => c.code === code);
      if (!match && name) {
        match = categories?.find((c) => c.name.toLowerCase() === name.toLowerCase());
      }
      if (!match && code) {
        // Fuzzy: code starts with
        match = categories?.find((c) => c.code.startsWith(code) || code.startsWith(c.code));
      }

      return {
        categoryCode: code,
        categoryName: name,
        amount: Math.abs(amount),
        matchedCategoryId: match?.id || null,
        matchedCategoryName: match ? `${match.code} – ${match.name}` : null,
        status: match ? "matched" as const : "unmatched" as const,
      };
    });

    setMappedRows(mapped);
    setStep("preview");
  };

  const handleImport = async () => {
    setStep("importing");
    const toInsert = mappedRows.filter((r) => r.status === "matched" && r.matchedCategoryId);
    let inserted = 0;
    let skipped = 0;

    // Batch insert in chunks of 50
    for (let i = 0; i < toInsert.length; i += 50) {
      const chunk = toInsert.slice(i, i + 50).map((r) => ({
        ngo_id: ngoId,
        fiscal_period_id: fiscalPeriodId,
        category_id: r.matchedCategoryId!,
        amount: r.amount,
        source: "csv_import",
        created_by_user_id: user?.id || null,
      }));

      const { error } = await supabase.from("actuals").insert(chunk as any);
      if (error) {
        toast({ variant: "destructive", title: "Import error", description: error.message });
        skipped += chunk.length;
      } else {
        inserted += chunk.length;
      }
    }

    skipped += mappedRows.filter((r) => r.status !== "matched").length;
    setImportResult({ inserted, skipped });
    queryClient.invalidateQueries({ queryKey: ["actuals"] });
    setStep("done");
  };

  const matchedCount = mappedRows.filter((r) => r.status === "matched").length;
  const unmatchedCount = mappedRows.filter((r) => r.status === "unmatched").length;
  const invalidCount = mappedRows.filter((r) => r.status === "invalid").length;

  const colOptions = [{ value: SKIP, label: "— Skip —" }, ...headers.map((h) => ({ value: h, label: h }))];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> Import Actuals from CSV
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file exported from QuickBooks or a spreadsheet to import actual amounts for this period.
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium">Click to select a CSV file</p>
              <p className="text-xs text-muted-foreground mt-1">
                Supported: .csv files with headers. Max recommended: 500 rows.
              </p>
            </div>
            <input ref={fileInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileChange} />
          </div>
        )}

        {/* Step 2: Column Mapping */}
        {step === "map" && (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                <strong>{fileName}</strong> — {rows.length} rows, {headers.length} columns detected.
                Map your CSV columns to the required fields below.
              </AlertDescription>
            </Alert>

            <div className="grid gap-3">
              <div className="grid grid-cols-2 items-center gap-2">
                <label className="text-sm font-medium">Category Code:</label>
                <Select value={codeCol} onValueChange={setCodeCol}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {colOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 items-center gap-2">
                <label className="text-sm font-medium">Category Name:</label>
                <Select value={nameCol} onValueChange={setNameCol}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {colOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 items-center gap-2">
                <label className="text-sm font-medium">Amount <span className="text-destructive">*</span>:</label>
                <Select value={amountCol} onValueChange={setAmountCol}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {colOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Preview first 3 raw rows */}
            <div className="text-xs text-muted-foreground">
              <p className="font-medium mb-1">Sample data (first 3 rows):</p>
              <div className="overflow-auto rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>{headers.map((h) => <TableHead key={h} className="text-xs py-1 px-2">{h}</TableHead>)}</TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 3).map((row, i) => (
                      <TableRow key={i}>
                        {headers.map((h) => <TableCell key={h} className="text-xs py-1 px-2">{row[h]}</TableCell>)}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={reset}>Back</Button>
              <Button onClick={handleMapping}>Preview Matches</Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Badge variant="default">{matchedCount} matched</Badge>
              {unmatchedCount > 0 && <Badge variant="destructive">{unmatchedCount} unmatched</Badge>}
              {invalidCount > 0 && <Badge variant="secondary">{invalidCount} invalid</Badge>}
            </div>

            {unmatchedCount > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {unmatchedCount} row(s) could not be matched to existing budget categories and will be skipped.
                </AlertDescription>
              </Alert>
            )}

            <div className="overflow-auto max-h-64 rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">CSV Code</TableHead>
                    <TableHead className="text-xs">CSV Name</TableHead>
                    <TableHead className="text-xs text-right">Amount</TableHead>
                    <TableHead className="text-xs">Matched Category</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappedRows.map((r, i) => (
                    <TableRow key={i} className={r.status !== "matched" ? "opacity-50" : ""}>
                      <TableCell className="py-1">
                        {r.status === "matched" && <CheckCircle2 className="h-4 w-4 text-primary" />}
                        {r.status === "unmatched" && <AlertCircle className="h-4 w-4 text-destructive" />}
                        {r.status === "invalid" && <AlertCircle className="h-4 w-4 text-muted-foreground" />}
                      </TableCell>
                      <TableCell className="text-xs py-1 font-mono">{r.categoryCode || "—"}</TableCell>
                      <TableCell className="text-xs py-1">{r.categoryName || "—"}</TableCell>
                      <TableCell className="text-xs py-1 text-right">{r.status === "invalid" ? "Invalid" : r.amount.toLocaleString()}</TableCell>
                      <TableCell className="text-xs py-1">{r.matchedCategoryName || "No match"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("map")}>Back</Button>
              <Button onClick={handleImport} disabled={matchedCount === 0}>
                Import {matchedCount} Row{matchedCount !== 1 ? "s" : ""}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 4: Importing */}
        {step === "importing" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Importing actuals…</p>
          </div>
        )}

        {/* Step 5: Done */}
        {step === "done" && (
          <div className="space-y-4 text-center py-4">
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
            <div>
              <p className="font-semibold">{importResult.inserted} row(s) imported successfully</p>
              {importResult.skipped > 0 && (
                <p className="text-sm text-muted-foreground">{importResult.skipped} row(s) skipped</p>
              )}
            </div>
            <DialogFooter className="justify-center">
              <Button onClick={() => { reset(); onOpenChange(false); }}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
