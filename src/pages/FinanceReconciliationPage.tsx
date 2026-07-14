import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FileSpreadsheet, Link2, Loader2, Plus, RefreshCw, Scale, Unlink } from "lucide-react";
import { useFinanceBankAccounts } from "@/hooks/useFinanceBankAccounts";
import {
  useCreateReconciliation, useFinalizeReconciliation, useFinanceReconciliationItems, useFinanceReconciliations, useRefreshReconciliationBalances, useToggleReconItemCleared,
} from "@/hooks/useFinanceReconciliation";
import {
  useConfirmFinanceBankStatementMatch,
  useFinanceBankStatementImports,
  useFinanceBankStatementTransactions,
  useIgnoreFinanceBankStatementTransaction,
  useImportFinanceBankStatement,
  useStartFinanceBankReconciliationFromStatement,
  useSuggestFinanceBankStatementMatches,
  useUnmatchFinanceBankStatementTransaction,
} from "@/hooks/useFinanceBankStatements";
import { useWorkspaceNgo } from "@/hooks/useWorkspaceNgo";

const fmt = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

const FinanceReconciliationPage = () => {
  const { selectedNgo, selectedNgoId } = useWorkspaceNgo();
  const { data: recons = [], isLoading } = useFinanceReconciliations(selectedNgoId);
  const { data: bankAccounts = [] } = useFinanceBankAccounts({ ngoId: selectedNgoId });
  const { data: statementImports = [] } = useFinanceBankStatementImports(selectedNgoId);
  const createRecon = useCreateReconciliation();
  const finalize = useFinalizeReconciliation();
  const refreshBalances = useRefreshReconciliationBalances();
  const toggleCleared = useToggleReconItemCleared();
  const importStatement = useImportFinanceBankStatement();
  const suggestMatches = useSuggestFinanceBankStatementMatches();
  const confirmMatch = useConfirmFinanceBankStatementMatch();
  const unmatchTransaction = useUnmatchFinanceBankStatementTransaction();
  const ignoreTransaction = useIgnoreFinanceBankStatementTransaction();
  const startFromStatement = useStartFinanceBankReconciliationFromStatement();

  const [bankId, setBankId] = useState("none");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [beginBal, setBeginBal] = useState("0");
  const [endBal, setEndBal] = useState("0");
  const [activeReconId, setActiveReconId] = useState<string | null>(null);
  const [exceptionNotes, setExceptionNotes] = useState("");
  const [statementFile, setStatementFile] = useState<File | null>(null);
  const [statementInputKey, setStatementInputKey] = useState(0);
  const [activeStatementImportId, setActiveStatementImportId] = useState<string | null>(null);

  const { data: items = [] } = useFinanceReconciliationItems(activeReconId);
  const { data: statementTransactions = [], isLoading: statementTransactionsLoading } = useFinanceBankStatementTransactions(activeStatementImportId);
  const activeRecon = recons.find((r) => r.id === activeReconId);
  const activeStatementImport = statementImports.find((statementImport) => statementImport.id === activeStatementImportId);
  const clearedTotal = items.filter((i) => i.is_cleared).reduce((s, i) => s + i.amount, 0);
  const difference = activeRecon ? activeRecon.ending_balance - (activeRecon.beginning_balance + clearedTotal) : 0;

  const handleImportStatement = async () => {
    if (!selectedNgoId || bankId === "none" || !statementFile || !startDate || !endDate) return;
    try {
      const result = await importStatement.mutateAsync({
        ngo_id: selectedNgoId,
        bank_account_id: bankId,
        statement_start_date: startDate,
        statement_end_date: endDate,
        beginning_balance: Number(beginBal),
        ending_balance: Number(endBal),
        file: statementFile,
      });
      setActiveStatementImportId(result.import.id);
      setStatementFile(null);
      setStatementInputKey((key) => key + 1);
    } catch {
      // Mutation toast contains the parsing, upload, or accounting validation error.
    }
  };

  return (
    <MainLayout
      title="Bank & Card Reconciliation"
      subtitle={`Import statements, match them to the live ledger, and close at zero difference for ${selectedNgo?.common_name || selectedNgo?.legal_name || "the selected NGO"}`}
    >
      <div className="space-y-6">
        {!selectedNgoId && (
          <Card className="border-amber-500/40 bg-amber-500/5"><CardContent className="py-4 text-sm">Select an NGO in the workspace header before importing or reconciling an account.</CardContent></Card>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><FileSpreadsheet className="h-4 w-4" />Import bank or card statement</CardTitle>
              <CardDescription>CSV columns are auto-detected. Debits become negative; credits/deposits become positive.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label>Account</Label>
                <Select value={bankId} onValueChange={setBankId}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">Select account</SelectItem>{bankAccounts.map((bank) => <SelectItem key={bank.id} value={bank.id}>{bank.account_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Statement start</Label><Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></div>
                <div className="space-y-2"><Label>Statement end</Label><Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Beginning balance</Label><Input type="number" step="0.01" value={beginBal} onChange={(event) => setBeginBal(event.target.value)} /></div>
                <div className="space-y-2"><Label>Ending balance</Label><Input type="number" step="0.01" value={endBal} onChange={(event) => setEndBal(event.target.value)} /></div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="statement-csv">Statement CSV</Label>
                <Input key={statementInputKey} id="statement-csv" type="file" accept=".csv,text/csv" onChange={(event) => setStatementFile(event.target.files?.[0] ?? null)} />
                <p className="text-xs text-muted-foreground">{statementFile ? statementFile.name : "Supported headers include Date, Description, Amount—or separate Debit and Credit columns."}</p>
              </div>
              <Button onClick={handleImportStatement} disabled={!selectedNgoId || bankId === "none" || !startDate || !endDate || !statementFile || importStatement.isPending}>
                {importStatement.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}Import and find matches
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Statement imports</CardTitle><CardDescription>Each exact file can be imported only once per account.</CardDescription></CardHeader>
            <CardContent>
              {!statementImports.length ? <p className="text-sm text-muted-foreground">No statements imported for this NGO.</p> : statementImports.map((statementImport) => (
                <button key={statementImport.id} type="button" className={`mb-2 w-full rounded border p-3 text-left hover:bg-muted/40 ${activeStatementImportId === statementImport.id ? "border-primary" : ""}`} onClick={() => setActiveStatementImportId(statementImport.id)}>
                  <div className="flex items-start justify-between gap-3"><div><p className="font-medium">{statementImport.file_name}</p><p className="text-xs text-muted-foreground">{statementImport.statement_start_date} — {statementImport.statement_end_date} · {statementImport.row_count} rows</p></div><Badge variant={statementImport.status === "reconciled" ? "default" : "secondary"}>{statementImport.status}</Badge></div>
                  <p className={`mt-2 text-xs ${Math.abs(statementImport.statement_variance) < 0.005 ? "text-emerald-700" : "text-amber-700"}`}>Statement tie-out: {fmt(statementImport.statement_variance)}</p>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        {activeStatementImport && (
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div><CardTitle className="flex items-center gap-2 text-base"><Link2 className="h-4 w-4" />Match statement to ledger</CardTitle><CardDescription>Amount and NGO must match exactly; automatic suggestions allow a seven-day posting window.</CardDescription></div>
              <div className="flex flex-wrap justify-end gap-2">
                {activeStatementImport.status === "matching" && <Button variant="outline" size="sm" onClick={() => suggestMatches.mutate(activeStatementImport.id)} disabled={suggestMatches.isPending}><RefreshCw className="mr-1 h-3 w-3" />Refresh suggestions</Button>}
                {activeStatementImport.status === "matching" && <Button size="sm" onClick={async () => {
                  try {
                    const reconciliation = await startFromStatement.mutateAsync(activeStatementImport);
                    setActiveReconId(reconciliation.id);
                  } catch {
                    // Mutation toast contains the accounting validation error.
                  }
                }} disabled={startFromStatement.isPending}><Scale className="mr-1 h-3 w-3" />Start reconciliation</Button>}
              </div>
            </CardHeader>
            <CardContent>
              {statementTransactionsLoading ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : (
                <div className="max-h-[32rem] overflow-auto rounded-md border">
                  <table className="w-full text-sm"><thead><tr className="border-b bg-muted/40 text-left text-muted-foreground"><th className="p-3">Date</th><th className="p-3">Description</th><th className="p-3 text-right">Amount</th><th className="p-3">Match</th><th className="p-3 text-right">Action</th></tr></thead>
                    <tbody>{statementTransactions.map((transaction) => (
                      <tr key={transaction.id} className="border-b last:border-0"><td className="p-3">{transaction.transaction_date}</td><td className="p-3"><p className="font-medium">{transaction.description}</p><p className="text-xs text-muted-foreground">{transaction.reference_number || transaction.source_transaction_id || "—"}</p></td><td className="p-3 text-right font-medium">{fmt(transaction.amount)}</td><td className="p-3"><Badge variant={transaction.match_status === "matched" || transaction.match_status === "reconciled" ? "default" : transaction.match_status === "suggested" ? "secondary" : "outline"}>{transaction.match_status}</Badge>{transaction.match_confidence !== null && <p className="mt-1 text-xs text-muted-foreground">{Math.round(transaction.match_confidence * 100)}% confidence</p>}{transaction.ignore_reason && <p className="mt-1 max-w-52 truncate text-xs text-muted-foreground">{transaction.ignore_reason}</p>}</td><td className="p-3 text-right">
                        {transaction.match_status === "suggested" ? <Button size="sm" variant="outline" onClick={() => confirmMatch.mutate({ transactionId: transaction.id })}>Confirm</Button>
                          : transaction.match_status === "matched" ? <Button size="sm" variant="ghost" onClick={() => unmatchTransaction.mutate({ transactionId: transaction.id })}><Unlink className="mr-1 h-3 w-3" />Unmatch</Button>
                            : transaction.match_status === "unmatched" ? <Button size="sm" variant="ghost" onClick={() => {
                              const reason = window.prompt("Why should this statement transaction be excluded from reconciliation matching?");
                              if (reason?.trim()) ignoreTransaction.mutate({ transactionId: transaction.id, extra: reason.trim() });
                            }}>Document exception</Button> : null}
                      </td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Manual reconciliation</CardTitle><CardDescription>Available when no CSV statement can be exported.</CardDescription></CardHeader>
            <CardContent>
              <Button disabled={!selectedNgoId || bankId === "none" || !startDate || !endDate || createRecon.isPending} onClick={async () => {
                if (!selectedNgoId) return;
                try {
                  const reconciliation = await createRecon.mutateAsync({ ngo_id: selectedNgoId, bank_account_id: bankId, statement_start_date: startDate, statement_end_date: endDate, beginning_balance: Number(beginBal), ending_balance: Number(endBal) });
                  setActiveReconId(reconciliation.id);
                } catch {
                  // Mutation toast contains the accounting validation error.
                }
              }}><Plus className="mr-2 h-4 w-4" />Start manual reconciliation</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Reconciliations</CardTitle></CardHeader>
            <CardContent>{isLoading ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : !recons.length ? <p className="text-sm text-muted-foreground">No reconciliations yet.</p> : recons.map((reconciliation) => (
              <button key={reconciliation.id} type="button" className={`mb-2 w-full rounded border p-3 text-left hover:bg-muted/40 ${activeReconId === reconciliation.id ? "border-primary" : ""}`} onClick={() => setActiveReconId(reconciliation.id)}><div className="flex justify-between gap-3"><span className="font-medium">{reconciliation.statement_start_date} — {reconciliation.statement_end_date}</span><Badge>{reconciliation.status}</Badge></div><p className="mt-1 text-xs text-muted-foreground">Difference: {fmt(reconciliation.difference)} {reconciliation.statement_import_id ? "· Statement-backed" : "· Manual"}</p></button>
            ))}</CardContent>
          </Card>
        </div>

        {activeRecon && activeRecon.status === "in_progress" && (
          <Card>
            <CardHeader><CardTitle className="text-base">Clear ledger transactions</CardTitle><CardDescription>Book balance: {fmt(Number(activeRecon.book_balance ?? 0))} · Cleared movement: {fmt(clearedTotal)} · Difference: {fmt(difference)}</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <Button variant="outline" size="sm" onClick={() => refreshBalances.mutate(activeRecon.id)} disabled={refreshBalances.isPending}><RefreshCw className="mr-1 h-3 w-3" />Refresh book balance</Button>
              <div className="max-h-96 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="p-2">Date</th><th className="p-2">Description</th><th className="p-2 text-right">Amount</th><th className="p-2">Statement evidence</th><th className="p-2">Cleared</th></tr></thead><tbody>{items.map((item) => (
                <tr key={item.id} className="border-b"><td className="p-2">{item.transaction_date || "—"}</td><td className="p-2">{item.description || "—"}</td><td className="p-2 text-right">{fmt(item.amount)}</td><td className="p-2">{item.statement_transaction_id ? <Badge variant="outline"><Link2 className="mr-1 h-3 w-3" />Matched</Badge> : "—"}</td><td className="p-2"><Switch checked={item.is_cleared} disabled={!!item.locked_at} onCheckedChange={(value) => toggleCleared.mutate({ itemId: item.id, isCleared: value })} /></td></tr>
              ))}</tbody></table></div>
              <div className="space-y-2"><Label>Close notes (optional)</Label><Textarea value={exceptionNotes} onChange={(event) => setExceptionNotes(event.target.value)} /></div>
              {Math.abs(difference) > 0.005 && <p className="text-sm text-amber-700">The difference must be exactly zero before this reconciliation can close.</p>}
              <Button onClick={() => finalize.mutate({ id: activeRecon.id, exceptionNotes: exceptionNotes || undefined })} disabled={finalize.isPending || Math.abs(difference) > 0.005}><Scale className="mr-2 h-4 w-4" />Finalize at zero difference</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
};

export default FinanceReconciliationPage;
