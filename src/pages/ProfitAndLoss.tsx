import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Printer } from "lucide-react";
import { useNGOs } from "@/hooks/useNGOs";
import { useFiscalPeriods } from "@/hooks/useFiscalPeriods";
import { useExtendedAccounts, defaultNormalBalance } from "@/hooks/useExtendedAccounts";
import { useOpeningBalances } from "@/hooks/useOpeningBalances";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { printElement } from "@/utils/financialPdfExport";

function fmt(n: number) { return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export default function ProfitAndLoss() {
  const { data: ngos } = useNGOs();
  const [selectedNgoId, setSelectedNgoId] = useState("");
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [comparePeriodId, setComparePeriodId] = useState("");
  const { data: periods } = useFiscalPeriods(selectedNgoId || undefined);
  const { data: accounts } = useExtendedAccounts(selectedNgoId || undefined);

  const { data: currentJE } = useQuery({
    queryKey: ["pnl_je_current", selectedNgoId, selectedPeriodId],
    enabled: !!selectedNgoId,
    queryFn: async () => {
      let q = (supabase as any).from("journal_entries")
        .select("debit, credit, account_id, transactions!inner(ngo_id, fiscal_period_id, is_void)")
        .eq("transactions.ngo_id", selectedNgoId).eq("transactions.is_void", false);
      if (selectedPeriodId) q = q.eq("transactions.fiscal_period_id", selectedPeriodId);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: prevJE } = useQuery({
    queryKey: ["pnl_je_prev", selectedNgoId, comparePeriodId],
    enabled: !!selectedNgoId && !!comparePeriodId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("journal_entries")
        .select("debit, credit, account_id, transactions!inner(ngo_id, fiscal_period_id, is_void)")
        .eq("transactions.ngo_id", selectedNgoId).eq("transactions.is_void", false)
        .eq("transactions.fiscal_period_id", comparePeriodId);
      if (error) throw error;
      return data as any[];
    },
  });

  const buildBalanceMap = (jeData: any[] | undefined) => {
    const map = new Map<string, number>();
    for (const je of jeData || []) {
      const acc = accounts?.find(a => a.id === je.account_id);
      if (!acc) continue;
      const nb = acc.normal_balance || defaultNormalBalance(acc.type);
      const val = nb === "credit" ? Number(je.credit) - Number(je.debit) : Number(je.debit) - Number(je.credit);
      map.set(je.account_id, (map.get(je.account_id) || 0) + val);
    }
    return map;
  };

  const currentMap = useMemo(() => buildBalanceMap(currentJE), [currentJE, accounts]);
  const prevMap = useMemo(() => buildBalanceMap(prevJE), [prevJE, accounts]);

  const sumSection = (map: Map<string, number>, section: string) => {
    let total = 0;
    accounts?.forEach(a => {
      if (a.income_statement_section === section) total += map.get(a.id) || 0;
    });
    return total;
  };

  const sections = [
    { label: "Revenue", section: "revenue", sign: 1 },
    { label: "Less: Sales Returns & Allowances", section: "contra_revenue", sign: -1 },
  ];

  const curRevenue = sumSection(currentMap, "revenue");
  const curContra = sumSection(currentMap, "contra_revenue");
  const curCOGS = sumSection(currentMap, "cogs");
  const curOpEx = sumSection(currentMap, "operating_expense");
  const curOtherIncome = sumSection(currentMap, "other_income");
  const curOtherExpense = sumSection(currentMap, "other_expense");

  const prevRevenue = sumSection(prevMap, "revenue");
  const prevContra = sumSection(prevMap, "contra_revenue");
  const prevCOGS = sumSection(prevMap, "cogs");
  const prevOpEx = sumSection(prevMap, "operating_expense");
  const prevOtherIncome = sumSection(prevMap, "other_income");
  const prevOtherExpense = sumSection(prevMap, "other_expense");

  const curNetRevenue = curRevenue - curContra;
  const curGrossProfit = curNetRevenue - curCOGS;
  const curNetIncome = curGrossProfit - curOpEx + curOtherIncome - curOtherExpense;

  const prevNetRevenue = prevRevenue - prevContra;
  const prevGrossProfit = prevNetRevenue - prevCOGS;
  const prevNetIncome = prevGrossProfit - prevOpEx + prevOtherIncome - prevOtherExpense;

  const hasPrev = !!comparePeriodId;
  const variance = (cur: number, prev: number) => cur - prev;
  const variancePct = (cur: number, prev: number) => prev !== 0 ? ((cur - prev) / Math.abs(prev)) * 100 : 0;

  const Row = ({ label, current, previous, bold = false }: { label: string; current: number; previous: number; bold?: boolean }) => (
    <div className={`grid grid-cols-5 gap-4 py-2 px-4 ${bold ? "font-bold bg-muted/30" : ""}`}>
      <div className="col-span-1">{label}</div>
      <div className="text-right">{fmt(current)}</div>
      {hasPrev && <div className="text-right">{fmt(previous)}</div>}
      {hasPrev && <div className={`text-right ${variance(current, previous) >= 0 ? "text-emerald-600" : "text-destructive"}`}>{fmt(variance(current, previous))}</div>}
      {hasPrev && <div className={`text-right ${variancePct(current, previous) >= 0 ? "text-emerald-600" : "text-destructive"}`}>{variancePct(current, previous).toFixed(1)}%</div>}
      {!hasPrev && <div className="col-span-3"></div>}
    </div>
  );

  return (
    <MainLayout title="Profit & Loss" subtitle="Income statement with period comparison">
      <div className="space-y-6 max-w-5xl mx-auto">
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>NGO</Label>
                <Select value={selectedNgoId} onValueChange={setSelectedNgoId}>
                  <SelectTrigger><SelectValue placeholder="Select NGO" /></SelectTrigger>
                  <SelectContent>{ngos?.map(n => <SelectItem key={n.id} value={n.id}>{n.legal_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Current Period</Label>
                <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
                  <SelectTrigger><SelectValue placeholder="All Periods" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Periods</SelectItem>
                    {periods?.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Compare Period</Label>
                <Select value={comparePeriodId} onValueChange={setComparePeriodId}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {periods?.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Profit & Loss Statement</CardTitle>
              <Button variant="outline" size="sm" className="no-print" onClick={() => printElement("pnl-report", "Profit & Loss Statement")}>
                <Printer className="w-4 h-4 mr-1" /> Print / PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-4 py-2 px-4 text-xs font-semibold uppercase text-muted-foreground border-b">
              <div>Category</div>
              <div className="text-right">Current</div>
              {hasPrev && <div className="text-right">Previous</div>}
              {hasPrev && <div className="text-right">Variance $</div>}
              {hasPrev && <div className="text-right">Variance %</div>}
              {!hasPrev && <div className="col-span-3"></div>}
            </div>

            <Row label="Revenue" current={curRevenue} previous={prevRevenue} />
            <Row label="Less: Returns & Allowances" current={curContra} previous={prevContra} />
            <Separator />
            <Row label="Net Revenue" current={curNetRevenue} previous={prevNetRevenue} bold />
            <Row label="Cost of Goods Sold" current={curCOGS} previous={prevCOGS} />
            <Separator />
            <Row label="Gross Profit" current={curGrossProfit} previous={prevGrossProfit} bold />
            <Row label="Operating Expenses" current={curOpEx} previous={prevOpEx} />
            <Row label="Other Income" current={curOtherIncome} previous={prevOtherIncome} />
            <Row label="Other Expenses" current={curOtherExpense} previous={prevOtherExpense} />
            <Separator />
            <Row label="Net Income" current={curNetIncome} previous={prevNetIncome} bold />
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
