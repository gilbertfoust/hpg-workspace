import { useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLedger } from "@/hooks/useLedger";
import { useExtendedAccounts, defaultNormalBalance } from "@/hooks/useExtendedAccounts";
import { useOpeningBalances } from "@/hooks/useOpeningBalances";
import { format } from "date-fns";

export default function AccountLedgerDetail() {
  const { accountId } = useParams<{ accountId: string }>();
  const [searchParams] = useSearchParams();
  const ngoId = searchParams.get("ngoId") || "";
  const periodId = searchParams.get("periodId") || "";

  const { data: accounts } = useExtendedAccounts(ngoId || undefined);
  const account = accounts?.find((a) => a.id === accountId);
  const { data: ledgerRows, isLoading } = useLedger(ngoId || undefined, accountId || undefined);
  const { data: openingBalances } = useOpeningBalances(ngoId || undefined, periodId || undefined);

  const normalBalance = account?.normal_balance || defaultNormalBalance(account?.type || "asset");
  
  const openingAmount = useMemo(() => {
    if (!openingBalances || !accountId) return 0;
    const ob = openingBalances.find((b) => b.account_id === accountId);
    return ob?.amount || 0;
  }, [openingBalances, accountId]);

  const rowsWithRunning = useMemo(() => {
    if (!ledgerRows) return [];
    let running = openingAmount;
    return ledgerRows.map((row) => {
      const change = normalBalance === "debit"
        ? row.debit - row.credit
        : row.credit - row.debit;
      running += change;
      return { ...row, runningBalance: running };
    });
  }, [ledgerRows, openingAmount, normalBalance]);

  const totalDebit = rowsWithRunning.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rowsWithRunning.reduce((s, r) => s + r.credit, 0);
  const endingBalance = rowsWithRunning.length > 0
    ? rowsWithRunning[rowsWithRunning.length - 1].runningBalance
    : openingAmount;

  return (
    <MainLayout
      title={account ? `${account.code} — ${account.name}` : "Account Ledger"}
      subtitle="Detailed ledger with running balance"
    >
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Beginning Balance</p>
              <p className="text-xl font-bold">{openingAmount.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Period Debits</p>
              <p className="text-xl font-bold">{totalDebit.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Period Credits</p>
              <p className="text-xl font-bold">{totalCredit.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Ending Balance</p>
              <p className="text-xl font-bold">{endingBalance.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Ledger Detail */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Ledger Entries</CardTitle>
              {account && (
                <div className="flex gap-2">
                  <Badge variant="outline" className="capitalize">{account.type}</Badge>
                  <Badge variant="secondary" className="capitalize">Normal: {normalBalance}</Badge>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10" />)}</div>
            ) : (
              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Ref #</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Opening balance row */}
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={5} className="font-medium">Beginning Balance</TableCell>
                      <TableCell className="text-right font-medium">{openingAmount.toFixed(2)}</TableCell>
                    </TableRow>
                    {rowsWithRunning.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-sm">{format(new Date(row.transaction_date), "MMM d, yyyy")}</TableCell>
                        <TableCell>{row.description}</TableCell>
                        <TableCell className="font-mono text-xs">{row.reference_number || "—"}</TableCell>
                        <TableCell className="text-right">{row.debit > 0 ? row.debit.toFixed(2) : ""}</TableCell>
                        <TableCell className="text-right">{row.credit > 0 ? row.credit.toFixed(2) : ""}</TableCell>
                        <TableCell className="text-right font-medium">{row.runningBalance.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                    {/* Ending balance row */}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell colSpan={3}>Ending Balance</TableCell>
                      <TableCell className="text-right">{totalDebit.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{totalCredit.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{endingBalance.toFixed(2)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
