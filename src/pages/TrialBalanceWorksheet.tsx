import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle, Download } from "lucide-react";
import { useNGOs } from "@/hooks/useNGOs";
import { useFiscalPeriods } from "@/hooks/useFiscalPeriods";
import { useExtendedAccounts, defaultNormalBalance } from "@/hooks/useExtendedAccounts";
import { useOpeningBalances } from "@/hooks/useOpeningBalances";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface TrialBalanceWorksheetRow {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  normal_balance: "debit" | "credit";
  beginning_balance: number;
  period_debit: number;
  period_credit: number;
  ending_balance: number;
}

export default function TrialBalanceWorksheet() {
  const { data: ngos } = useNGOs();
  const [selectedNgoId, setSelectedNgoId] = useState<string>("");
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const { data: periods } = useFiscalPeriods(selectedNgoId || undefined);
  const { data: accounts } = useExtendedAccounts(selectedNgoId || undefined);
  const { data: openingBalances } = useOpeningBalances(selectedNgoId || undefined, selectedPeriodId || undefined);

  // Fetch journal entries for the selected period
  const { data: journalData } = useQuery({
    queryKey: ["tb_journal_data", selectedNgoId, selectedPeriodId],
    enabled: !!selectedNgoId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("journal_entries")
        .select("debit, credit, account_id, transactions!inner(ngo_id, fiscal_period_id, is_void)")
        .eq("transactions.ngo_id", selectedNgoId)
        .eq("transactions.is_void", false);
      if (selectedPeriodId) q = q.eq("transactions.fiscal_period_id", selectedPeriodId);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  const rows: TrialBalanceWorksheetRow[] = useMemo(() => {
    if (!accounts) return [];
    
    // Aggregate journal entries by account
    const jeMap = new Map<string, { debit: number; credit: number }>();
    for (const je of journalData || []) {
      const existing = jeMap.get(je.account_id) || { debit: 0, credit: 0 };
      existing.debit += Number(je.debit);
      existing.credit += Number(je.credit);
      jeMap.set(je.account_id, existing);
    }

    // Build opening balance map
    const obMap = new Map<string, number>();
    for (const ob of openingBalances || []) {
      obMap.set(ob.account_id, ob.amount);
    }

    return accounts
      .filter((a) => jeMap.has(a.id) || obMap.has(a.id))
      .map((a) => {
        const nb = (a.normal_balance || defaultNormalBalance(a.type)) as "debit" | "credit";
        const beginning = obMap.get(a.id) || 0;
        const je = jeMap.get(a.id) || { debit: 0, credit: 0 };
        const change = nb === "debit" ? je.debit - je.credit : je.credit - je.debit;
        return {
          account_id: a.id,
          account_code: a.code,
          account_name: a.name,
          account_type: a.type,
          normal_balance: nb,
          beginning_balance: beginning,
          period_debit: je.debit,
          period_credit: je.credit,
          ending_balance: beginning + change,
        };
      })
      .sort((a, b) => a.account_code.localeCompare(b.account_code));
  }, [accounts, journalData, openingBalances]);

  const totalDebit = rows.reduce((s, r) => s + r.period_debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.period_credit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const handleExport = () => {
    const csv = [
      "Code,Account,Type,Beginning Balance,Debit,Credit,Ending Balance",
      ...rows.map((r) =>
        `${r.account_code},"${r.account_name}",${r.account_type},${r.beginning_balance.toFixed(2)},${r.period_debit.toFixed(2)},${r.period_credit.toFixed(2)},${r.ending_balance.toFixed(2)}`
      ),
      `,,Totals,,${totalDebit.toFixed(2)},${totalCredit.toFixed(2)},`,
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "trial-balance-worksheet.csv";
    a.click();
  };

  return (
    <MainLayout title="Trial Balance Worksheet" subtitle="Beginning balances, period activity, and ending balances">
      <div className="space-y-6 max-w-6xl mx-auto">
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <Label>NGO</Label>
                <Select value={selectedNgoId} onValueChange={setSelectedNgoId}>
                  <SelectTrigger><SelectValue placeholder="Select NGO" /></SelectTrigger>
                  <SelectContent>
                    {ngos?.map((n) => <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fiscal Period</Label>
                <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
                  <SelectTrigger><SelectValue placeholder="All Periods" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Periods</SelectItem>
                    {periods?.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                {isBalanced && rows.length > 0 ? (
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 h-9 px-3">
                    <CheckCircle className="w-4 h-4 mr-1" /> Balanced
                  </Badge>
                ) : rows.length > 0 ? (
                  <Badge variant="destructive" className="h-9 px-3">
                    <AlertCircle className="w-4 h-4 mr-1" /> Out of balance: {Math.abs(totalDebit - totalCredit).toFixed(2)}
                  </Badge>
                ) : null}
                <Button variant="outline" size="sm" onClick={handleExport} disabled={rows.length === 0}>
                  <Download className="w-4 h-4 mr-1" /> Export CSV
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="rounded-md border-0 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Account Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Beginning Balance</TableHead>
                    <TableHead className="text-right">Period Debit</TableHead>
                    <TableHead className="text-right">Period Credit</TableHead>
                    <TableHead className="text-right">Ending Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.account_id}>
                      <TableCell className="font-mono text-sm">{row.account_code}</TableCell>
                      <TableCell>{row.account_name}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize text-xs">{row.account_type}</Badge></TableCell>
                      <TableCell className="text-right">{row.beginning_balance.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{row.period_debit.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{row.period_credit.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium">{row.ending_balance.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={4} className="text-right">Totals</TableCell>
                    <TableCell className="text-right">{totalDebit.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{totalCredit.toFixed(2)}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Select an NGO to view the trial balance
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
