import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { useNGOs } from "@/hooks/useNGOs";
import { useFiscalPeriods } from "@/hooks/useFiscalPeriods";
import { useExtendedAccounts, defaultNormalBalance } from "@/hooks/useExtendedAccounts";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

function fmt(n: number) { return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export default function PeriodComparisonPage() {
  const { data: ngos } = useNGOs();
  const [selectedNgoId, setSelectedNgoId] = useState("");
  const [currentPeriodId, setCurrentPeriodId] = useState("");
  const [previousPeriodId, setPreviousPeriodId] = useState("");
  const { data: periods } = useFiscalPeriods(selectedNgoId || undefined);
  const { data: accounts } = useExtendedAccounts(selectedNgoId || undefined);

  const fetchPeriodData = async (periodId: string) => {
    if (!periodId || !selectedNgoId) return [];
    const { data, error } = await (supabase as any).from("journal_entries")
      .select("debit, credit, account_id, transactions!inner(ngo_id, fiscal_period_id, is_void)")
      .eq("transactions.ngo_id", selectedNgoId).eq("transactions.is_void", false)
      .eq("transactions.fiscal_period_id", periodId);
    if (error) throw error;
    return data as any[];
  };

  const { data: currentJE } = useQuery({
    queryKey: ["pc_current", selectedNgoId, currentPeriodId],
    enabled: !!selectedNgoId && !!currentPeriodId,
    queryFn: () => fetchPeriodData(currentPeriodId),
  });

  const { data: prevJE } = useQuery({
    queryKey: ["pc_prev", selectedNgoId, previousPeriodId],
    enabled: !!selectedNgoId && !!previousPeriodId,
    queryFn: () => fetchPeriodData(previousPeriodId),
  });

  const buildSummary = (jeData: any[] | undefined) => {
    const result = { revenue: 0, expenses: 0, cashReceipts: 0, cashPayments: 0 };
    for (const je of jeData || []) {
      const acc = accounts?.find(a => a.id === je.account_id);
      if (!acc) continue;
      const nb = acc.normal_balance || defaultNormalBalance(acc.type);
      const balance = nb === "credit" ? Number(je.credit) - Number(je.debit) : Number(je.debit) - Number(je.credit);
      
      if (acc.type === "income") result.revenue += balance;
      if (acc.type === "expense") result.expenses += balance;
      if (acc.cash_flow_section === "operating" && acc.type === "income") result.cashReceipts += balance;
      if (acc.cash_flow_section === "operating" && acc.type === "expense") result.cashPayments += balance;
    }
    return result;
  };

  const current = useMemo(() => buildSummary(currentJE), [currentJE, accounts]);
  const previous = useMemo(() => buildSummary(prevJE), [prevJE, accounts]);

  const ComparisonRow = ({ label, cur, prev }: { label: string; cur: number; prev: number }) => {
    const diff = cur - prev;
    const icon = diff > 0 ? <ArrowUp className="w-4 h-4 text-emerald-500" /> : diff < 0 ? <ArrowDown className="w-4 h-4 text-destructive" /> : <Minus className="w-4 h-4 text-muted-foreground" />;
    return (
      <div className="grid grid-cols-4 gap-4 py-3 px-4">
        <div className="font-medium">{label}</div>
        <div className="text-right">{fmt(cur)}</div>
        <div className="text-right">{fmt(prev)}</div>
        <div className="flex items-center justify-end gap-2">
          {icon}
          <span className={diff >= 0 ? "text-emerald-600" : "text-destructive"}>{fmt(diff)}</span>
        </div>
      </div>
    );
  };

  const hasData = !!currentPeriodId && !!previousPeriodId;

  return (
    <MainLayout title="Period Comparison" subtitle="Compare current vs. previous period performance">
      <div className="space-y-6 max-w-4xl mx-auto">
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
                <Select value={currentPeriodId} onValueChange={setCurrentPeriodId}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{periods?.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Previous Period</Label>
                <Select value={previousPeriodId} onValueChange={setPreviousPeriodId}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{periods?.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {hasData && (
          <>
            <Card>
              <CardHeader><CardTitle>Profit & Loss Summary</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-4 gap-4 py-2 px-4 text-xs font-semibold uppercase text-muted-foreground border-b">
                  <div>Category</div>
                  <div className="text-right">Current</div>
                  <div className="text-right">Previous</div>
                  <div className="text-right">Change</div>
                </div>
                <ComparisonRow label="Revenue" cur={current.revenue} prev={previous.revenue} />
                <ComparisonRow label="Expenses" cur={current.expenses} prev={previous.expenses} />
                <Separator />
                <ComparisonRow label="Net Income" cur={current.revenue - current.expenses} prev={previous.revenue - previous.expenses} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Cash Position Summary</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-4 gap-4 py-2 px-4 text-xs font-semibold uppercase text-muted-foreground border-b">
                  <div>Category</div>
                  <div className="text-right">Current</div>
                  <div className="text-right">Previous</div>
                  <div className="text-right">Change</div>
                </div>
                <ComparisonRow label="Cash Receipts" cur={current.cashReceipts} prev={previous.cashReceipts} />
                <ComparisonRow label="Cash Payments" cur={current.cashPayments} prev={previous.cashPayments} />
                <Separator />
                <ComparisonRow label="Net Cash" cur={current.cashReceipts - current.cashPayments} prev={previous.cashReceipts - previous.cashPayments} />
              </CardContent>
            </Card>
          </>
        )}

        {!hasData && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Select an NGO and two periods to compare.
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
