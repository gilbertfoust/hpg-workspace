import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useDeleteFinanceOpeningBalance,
  useFinanceFiscalPeriods,
  useFinanceOpeningBalances,
  useImportFinanceOpeningBalances,
  usePostFinanceOpeningBalances,
  useUpsertFinanceOpeningBalance,
} from "@/hooks/useFinanceFiscalPeriods";
import { useFinanceAccounts } from "@/hooks/useFinanceAccounts";
import { hasFinancePermission } from "@/lib/financePermissions";
import { useUserRole } from "@/hooks/useUserRole";
import { useWorkspaceNgo } from "@/hooks/useWorkspaceNgo";
import { CheckCircle2, Download, FileSpreadsheet, Trash2 } from "lucide-react";

const fmt = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

const FinanceOpeningBalancesPage = () => {
  const { selectedNgo, selectedNgoId } = useWorkspaceNgo();
  const { role } = useUserRole();
  const canManage = hasFinancePermission(role, "edit_settings");
  const { data: periods = [] } = useFinanceFiscalPeriods(selectedNgoId);
  const { data: accounts = [] } = useFinanceAccounts();
  const [periodId, setPeriodId] = useState("");
  const { data: balances = [] } = useFinanceOpeningBalances(periodId || undefined);
  const upsert = useUpsertFinanceOpeningBalance();
  const importBalances = useImportFinanceOpeningBalances();
  const postBalances = usePostFinanceOpeningBalances();
  const deleteBalance = useDeleteFinanceOpeningBalance();
  const [sourceFile, setSourceFile] = useState<File | null>(null);

  const [accountId, setAccountId] = useState("none");
  const [debit, setDebit] = useState(0);
  const [credit, setCredit] = useState(0);

  useEffect(() => {
    setPeriodId("");
    setSourceFile(null);
  }, [selectedNgoId]);

  const selectedPeriod = periods.find((p) => p.id === periodId);
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const totalDebit = balances.reduce((sum, balance) => sum + Number(balance.debit), 0);
  const totalCredit = balances.reduce((sum, balance) => sum + Number(balance.credit), 0);
  const isBalanced = balances.length >= 2 && Math.abs(totalDebit - totalCredit) < 0.005 && totalDebit > 0;
  const isPosted = !!selectedPeriod?.opening_balance_journal_entry_id;
  const canEdit = canManage && selectedPeriod?.status === "open" && !isPosted;

  const downloadTemplate = () => {
    const csv = "Account Code,Debit,Credit,Memo\n1000,1000.00,,Beginning cash\n3000,,1000.00,Beginning net assets\n";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "opening-balances-template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <MainLayout
      title="Opening Balances"
      subtitle={`Beginning balances for ${selectedNgo?.common_name || selectedNgo?.legal_name || "HPG operating"}`}
    >
      <Card className="mb-4">
        <CardContent className="pt-6">
          <Label>Fiscal period</Label>
          <Select value={periodId} onValueChange={setPeriodId}>
            <SelectTrigger className="max-w-md mt-2"><SelectValue placeholder="Select period" /></SelectTrigger>
            <SelectContent>
              {periods.filter((p) => p.period_type === "month").map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.label} ({p.status})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedPeriod && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant={selectedPeriod.status === "open" ? "default" : "secondary"}>{selectedPeriod.status}</Badge>
              {selectedPeriod.opening_balance_source_document_id && <Badge variant="outline">Source CSV attached</Badge>}
              {isPosted && <Badge><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Posted to ledger</Badge>}
            </div>
          )}
        </CardContent>
      </Card>

      {periodId && canEdit && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">1. Import the balanced go-live CSV</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Required columns: Account Code, Debit, Credit, and optional Memo. Importing replaces the staged rows and keeps the original CSV as audit evidence.
            </p>
            <div className="flex flex-wrap gap-3 items-center">
              <Input
                type="file"
                accept=".csv,text/csv"
                className="max-w-md"
                onChange={(event) => setSourceFile(event.target.files?.[0] ?? null)}
              />
              <Button
                disabled={!sourceFile || importBalances.isPending}
                onClick={() => sourceFile && importBalances.mutate({ fiscalPeriodId: periodId, ngoId: selectedNgoId, file: sourceFile })}
              >
                <FileSpreadsheet className="h-4 w-4 mr-1" />Import CSV
              </Button>
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-1" />Template
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {periodId && canEdit && selectedPeriod?.opening_balance_source_document_id && (
        <Card className="mb-4">
          <CardHeader><CardTitle className="text-base">2. Review or adjust staged balances</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-4 gap-3 items-end">
            <div>
              <Label>Account</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue placeholder="Account" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select</SelectItem>
                  {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Debit</Label><Input type="number" value={debit || ""} onChange={(e) => setDebit(Number(e.target.value))} /></div>
            <div><Label>Credit</Label><Input type="number" value={credit || ""} onChange={(e) => setCredit(Number(e.target.value))} /></div>
            <Button
              disabled={accountId === "none" || (debit > 0) === (credit > 0)}
              onClick={() => upsert.mutate({
                fiscal_period_id: periodId,
                account_id: accountId,
                debit,
                credit,
                ngo_id: selectedNgoId,
              }, { onSuccess: () => { setDebit(0); setCredit(0); setAccountId("none"); } })}
            >
              Save
            </Button>
          </CardContent>
        </Card>
      )}

      {periodId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{isPosted ? "Posted opening-balance journal" : "3. Balance and post"} — {selectedPeriod?.label}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {balances.length > 0 && (
              <Alert variant={isBalanced ? "default" : "destructive"}>
                <AlertTitle>{isBalanced ? "Balanced and ready for posting" : "Debits and credits must match"}</AlertTitle>
                <AlertDescription>
                  Debits {fmt(totalDebit)} · Credits {fmt(totalCredit)} · Difference {fmt(totalDebit - totalCredit)}
                </AlertDescription>
              </Alert>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  {canEdit && <TableHead className="w-12" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {balances.map((b) => {
                  const acct = accountMap.get(b.account_id);
                  return (
                    <TableRow key={b.id}>
                      <TableCell>{acct ? `${acct.code} — ${acct.name}` : b.account_id}</TableCell>
                      <TableCell className="text-right">{b.debit > 0 ? fmt(b.debit) : "—"}</TableCell>
                      <TableCell className="text-right">{b.credit > 0 ? fmt(b.credit) : "—"}</TableCell>
                      {canEdit && (
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Remove opening balance"
                            onClick={() => deleteBalance.mutate({ id: b.id, fiscalPeriodId: periodId })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {canEdit && balances.length > 0 && (
              <div className="flex justify-end">
                <Button
                  disabled={!isBalanced || !selectedPeriod?.opening_balance_source_document_id || postBalances.isPending}
                  onClick={() => postBalances.mutate(periodId)}
                >
                  Post balanced opening journal
                </Button>
              </div>
            )}
            {selectedPeriod?.status !== "open" && !isPosted && (
              <p className="text-sm text-destructive">Reopen this period before changing or posting opening balances.</p>
            )}
          </CardContent>
        </Card>
      )}
    </MainLayout>
  );
};

export default FinanceOpeningBalancesPage;
