import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useNGOs } from "@/hooks/useNGOs";
import { useFiscalPeriods } from "@/hooks/useFiscalPeriods";
import { useExtendedAccounts, defaultNormalBalance } from "@/hooks/useExtendedAccounts";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

function fmt(n: number) { return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export default function BalanceSheetPage() {
  const { data: ngos } = useNGOs();
  const [selectedNgoId, setSelectedNgoId] = useState("");
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const { data: periods } = useFiscalPeriods(selectedNgoId || undefined);
  const { data: accounts } = useExtendedAccounts(selectedNgoId || undefined);

  const { data: jeData } = useQuery({
    queryKey: ["bs_je", selectedNgoId, selectedPeriodId],
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

  const balanceMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const je of jeData || []) {
      const acc = accounts?.find(a => a.id === je.account_id);
      if (!acc) continue;
      const nb = acc.normal_balance || defaultNormalBalance(acc.type);
      const val = nb === "debit" ? Number(je.debit) - Number(je.credit) : Number(je.credit) - Number(je.debit);
      map.set(je.account_id, (map.get(je.account_id) || 0) + val);
    }
    return map;
  }, [jeData, accounts]);

  const sumSection = (bsSection: string) => {
    let total = 0;
    accounts?.forEach(a => {
      if (a.balance_sheet_section === bsSection) total += balanceMap.get(a.id) || 0;
    });
    return total;
  };

  const sumType = (type: string) => {
    let total = 0;
    accounts?.forEach(a => {
      if (a.type === type && a.financial_statement_type === "balance_sheet") total += balanceMap.get(a.id) || 0;
    });
    return total;
  };

  const currentAssets = sumSection("current_asset");
  const fixedAssets = sumSection("fixed_asset");
  const otherAssets = sumSection("other_asset");
  const totalAssets = currentAssets + fixedAssets + otherAssets || sumType("asset");

  const currentLiabilities = sumSection("current_liability");
  const longTermLiabilities = sumSection("long_term_liability");
  const totalLiabilities = currentLiabilities + longTermLiabilities || sumType("liability");

  const equity = sumSection("equity") || sumType("equity");
  const totalLiabilitiesAndEquity = totalLiabilities + equity;

  // Ratios
  const debtRatio = totalAssets !== 0 ? totalLiabilities / totalAssets : 0;
  const currentRatio = currentLiabilities !== 0 ? currentAssets / currentLiabilities : 0;
  const workingCapital = currentAssets - currentLiabilities;
  const assetsToEquity = equity !== 0 ? totalAssets / equity : 0;
  const debtToEquity = equity !== 0 ? totalLiabilities / equity : 0;

  const SectionRow = ({ label, amount, bold = false }: { label: string; amount: number; bold?: boolean }) => (
    <div className={`flex justify-between py-2 px-4 ${bold ? "font-bold bg-muted/30" : ""}`}>
      <span>{label}</span>
      <span>{fmt(amount)}</span>
    </div>
  );

  return (
    <MainLayout title="Balance Sheet" subtitle="Assets, liabilities, and equity">
      <div className="space-y-6 max-w-4xl mx-auto">
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>NGO</Label>
                <Select value={selectedNgoId} onValueChange={setSelectedNgoId}>
                  <SelectTrigger><SelectValue placeholder="Select NGO" /></SelectTrigger>
                  <SelectContent>{ngos?.map(n => <SelectItem key={n.id} value={n.id}>{n.legal_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>As of Period</Label>
                <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
                  <SelectTrigger><SelectValue placeholder="All Periods" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Periods</SelectItem>
                    {periods?.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Assets */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Assets</CardTitle></CardHeader>
            <CardContent className="space-y-1 p-0 pb-4">
              <SectionRow label="Current Assets" amount={currentAssets} />
              <SectionRow label="Fixed Assets" amount={fixedAssets} />
              <SectionRow label="Other Assets" amount={otherAssets} />
              <Separator />
              <SectionRow label="Total Assets" amount={totalAssets} bold />
            </CardContent>
          </Card>

          {/* Liabilities & Equity */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Liabilities & Equity</CardTitle></CardHeader>
            <CardContent className="space-y-1 p-0 pb-4">
              <SectionRow label="Current Liabilities" amount={currentLiabilities} />
              <SectionRow label="Long-Term Liabilities" amount={longTermLiabilities} />
              <Separator />
              <SectionRow label="Total Liabilities" amount={totalLiabilities} bold />
              <SectionRow label="Net Assets / Equity" amount={equity} />
              <Separator />
              <SectionRow label="Total Liabilities & Equity" amount={totalLiabilitiesAndEquity} bold />
            </CardContent>
          </Card>
        </div>

        {/* Financial Ratios */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Financial Ratios</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: "Debt Ratio", value: debtRatio.toFixed(2) },
                { label: "Current Ratio", value: currentRatio.toFixed(2) },
                { label: "Working Capital", value: fmt(workingCapital) },
                { label: "Assets-to-Equity", value: assetsToEquity.toFixed(2) },
                { label: "Debt-to-Equity", value: debtToEquity.toFixed(2) },
              ].map((r) => (
                <div key={r.label} className="text-center p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground">{r.label}</p>
                  <p className="text-lg font-bold">{r.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
