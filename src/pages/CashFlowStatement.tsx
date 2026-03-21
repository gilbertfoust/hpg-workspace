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

export default function CashFlowStatement() {
  const { data: ngos } = useNGOs();
  const [selectedNgoId, setSelectedNgoId] = useState("");
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const { data: periods } = useFiscalPeriods(selectedNgoId || undefined);
  const { data: accounts } = useExtendedAccounts(selectedNgoId || undefined);

  const { data: jeData } = useQuery({
    queryKey: ["cf_je", selectedNgoId, selectedPeriodId],
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

  const sumCFSection = (section: string) => {
    let total = 0;
    const acctIds = accounts?.filter(a => a.cash_flow_section === section).map(a => a.id) || [];
    for (const je of jeData || []) {
      if (acctIds.includes(je.account_id)) {
        total += Number(je.credit) - Number(je.debit);
      }
    }
    return total;
  };

  // For cash accounts: compute beginning and ending balance
  const cashAccounts = accounts?.filter(a => a.type === "asset" && (a.balance_sheet_section === "current_asset" || a.code?.startsWith("1"))) || [];
  
  const operating = sumCFSection("operating");
  const investing = sumCFSection("investing");
  const financing = sumCFSection("financing");
  const netChange = operating + investing + financing;

  const SectionRow = ({ label, amount, bold = false, indent = false }: { label: string; amount: number; bold?: boolean; indent?: boolean }) => (
    <div className={`flex justify-between py-2 px-4 ${bold ? "font-bold bg-muted/30" : ""} ${indent ? "pl-8" : ""}`}>
      <span>{label}</span>
      <span className={amount < 0 ? "text-destructive" : ""}>{fmt(amount)}</span>
    </div>
  );

  return (
    <MainLayout title="Cash Flow Statement" subtitle="Operating, investing, and financing activities">
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
                <Label>Fiscal Period</Label>
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

        <Card>
          <CardHeader><CardTitle>Cash Flow Statement (Indirect Method)</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            <p className="text-sm font-semibold text-muted-foreground px-4 pt-2">Operating Activities</p>
            <SectionRow label="Net Cash from Operations" amount={operating} />
            <Separator />

            <p className="text-sm font-semibold text-muted-foreground px-4 pt-2">Investing Activities</p>
            <SectionRow label="Net Cash from Investing" amount={investing} />
            <Separator />

            <p className="text-sm font-semibold text-muted-foreground px-4 pt-2">Financing Activities</p>
            <SectionRow label="Net Cash from Financing" amount={financing} />
            <Separator />

            <SectionRow label="Net Increase / (Decrease) in Cash" amount={netChange} bold />
          </CardContent>
        </Card>

        {!selectedNgoId && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Select an NGO to view the cash flow statement. Map accounts to cash flow sections via the Chart of Accounts.
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
