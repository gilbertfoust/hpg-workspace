import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { TrialBalanceTable } from "@/components/finance/TrialBalanceTable";
import { useTrialBalance } from "@/hooks/useTrialBalance";
import { useFiscalPeriods } from "@/hooks/useFiscalPeriods";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { printElement } from "@/utils/financialPdfExport";

const TrialBalancePage = () => {
  const [ngoId, setNgoId] = useState("");
  const [periodId, setPeriodId] = useState("");

  const { data: ngos } = useQuery({
    queryKey: ["ngos_list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ngos").select("id, common_name, legal_name").order("common_name");
      if (error) throw error;
      return data || [];
    },
  });

  const activeNgoId = ngoId && ngoId !== "__all__" ? ngoId : undefined;
  const { data: periods } = useFiscalPeriods(activeNgoId);
  const { data: rows, isLoading } = useTrialBalance(activeNgoId, periodId || undefined);

  return (
    <MainLayout>
      <div className="space-y-6 p-6">
        <h1 className="text-2xl font-bold">Trial Balance</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl">
          <div>
            <Label>NGO</Label>
            <Select value={ngoId} onValueChange={(v) => { setNgoId(v); setPeriodId(""); }}>
              <SelectTrigger><SelectValue placeholder="Select NGO" /></SelectTrigger>
              <SelectContent>
                {(ngos || []).map((n) => (
                  <SelectItem key={n.id} value={n.id}>{n.common_name || n.legal_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Fiscal Period (optional)</Label>
            <Select value={periodId} onValueChange={setPeriodId}>
              <SelectTrigger><SelectValue placeholder="All periods" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Periods</SelectItem>
                {(periods || []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {activeNgoId && (
          <div className="flex justify-end no-print">
            <Button variant="outline" size="sm" onClick={() => printElement("tb-report", "Trial Balance")}>
              <Printer className="w-4 h-4 mr-1" /> Print / PDF
            </Button>
          </div>
        )}

        {activeNgoId ? (
          <div id="tb-report">
            <TrialBalanceTable rows={rows || []} isLoading={isLoading} />
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8">Select an NGO to view the trial balance.</div>
        )}
      </div>
    </MainLayout>
  );
};

export default TrialBalancePage;
