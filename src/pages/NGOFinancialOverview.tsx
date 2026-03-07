import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PeriodSummaryCard } from "@/components/finance/PeriodSummaryCard";
import { BudgetActualTable } from "@/components/finance/BudgetActualTable";
import { BudgetActualChart } from "@/components/finance/BudgetActualChart";
import { FinanceDocsTab } from "@/components/finance/FinanceDocsTab";
import { useFiscalPeriods } from "@/hooks/useFiscalPeriods";
import { useActuals } from "@/hooks/useActuals";
import { useFinancialReviewStatus } from "@/hooks/useFinancialReviewStatus";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CreateFiscalPeriodDialog } from "@/components/finance/CreateFiscalPeriodDialog";
import { Loader2, ArrowLeft, ChevronRight, Plus } from "lucide-react";

const NGOFinancialOverview = () => {
  const { ngoId } = useParams<{ ngoId: string }>();
  const navigate = useNavigate();
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [createPeriodOpen, setCreatePeriodOpen] = useState(false);

  // Fetch NGO details
  const { data: ngo, isLoading: ngoLoading } = useQuery({
    queryKey: ["ngo_detail", ngoId],
    enabled: !!ngoId,
    queryFn: async () => {
      const { data, error } = await supabase.from("ngos").select("*").eq("id", ngoId!).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: periods, isLoading: periodsLoading } = useFiscalPeriods(ngoId);
  const { data: reviews } = useFinancialReviewStatus(ngoId);

  // For Budget vs Actual tab - fetch actuals for selected period to compute totals
  const { data: categories } = useQuery({
    queryKey: ["budget_categories_types"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("budget_categories").select("id, type");
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: allActuals } = useQuery({
    queryKey: ["actuals_ngo", ngoId],
    enabled: !!ngoId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("actuals").select("*").eq("ngo_id", ngoId!);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const getReviewStatus = (periodId: string) => {
    return reviews?.find((r) => r.fiscal_period_id === periodId)?.status || "not_started";
  };

  const getPeriodTotals = (periodId: string) => {
    const catTypeMap = new Map((categories || []).map((c: any) => [c.id, c.type]));
    let income = 0, expense = 0;
    (allActuals || []).filter((a: any) => a.fiscal_period_id === periodId).forEach((a: any) => {
      const t = catTypeMap.get(a.category_id);
      if (t === "income") income += Number(a.amount);
      else if (t === "expense") expense += Number(a.amount);
    });
    return { income, expense };
  };

  if (ngoLoading || periodsLoading) {
    return <MainLayout><div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div></MainLayout>;
  }

  return (
    <MainLayout>
      <div className="space-y-6 p-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/financial-hub" className="hover:text-foreground">Financial Hub</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">{ngo?.common_name || ngo?.legal_name}</span>
        </div>

        {/* NGO Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{ngo?.common_name || ngo?.legal_name}</h1>
            <div className="flex gap-4 text-sm text-muted-foreground mt-1">
              {ngo?.legal_name !== ngo?.common_name && ngo?.legal_name && <span>Legal: {ngo.legal_name}</span>}
              {ngo?.country && <span>{ngo.country}</span>}
              {(ngo as any)?.region && <span>{(ngo as any).region}</span>}
              {ngo?.status && <Badge variant="outline" className="capitalize">{ngo.status}</Badge>}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/financial-hub")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="periods">
          <TabsList>
            <TabsTrigger value="periods">Periods</TabsTrigger>
            <TabsTrigger value="bva">Budget vs Actual</TabsTrigger>
            <TabsTrigger value="docs">Docs & Notes</TabsTrigger>
          </TabsList>

          <TabsContent value="periods" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setCreatePeriodOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> New Period
              </Button>
            </div>
            {!periods || periods.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">No fiscal periods defined for this NGO yet.</CardContent></Card>
            ) : (
              periods.map((p) => {
                const totals = getPeriodTotals(p.id);
                return (
                  <div key={p.id} className="flex items-start gap-4">
                    <div className="flex-1">
                      <PeriodSummaryCard
                        label={p.label}
                        periodType={p.period_type}
                        startDate={p.start_date}
                        endDate={p.end_date}
                        currency={p.currency_code}
                        totalIncome={totals.income}
                        totalExpense={totals.expense}
                        reviewStatus={getReviewStatus(p.id)}
                      />
                    </div>
                    <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate(`/financial-hub/ngo/${ngoId}/period/${p.id}`)}>
                      Open Period <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="bva" className="space-y-4 mt-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium">Select Period:</label>
              <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
                <SelectTrigger className="w-60"><SelectValue placeholder="Choose a period" /></SelectTrigger>
                <SelectContent>
                  {(periods || []).map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {selectedPeriodId && ngoId ? (
              <div className="space-y-6">
                <BudgetActualChart ngoId={ngoId} fiscalPeriodId={selectedPeriodId} />
                <BudgetActualTable ngoId={ngoId} fiscalPeriodId={selectedPeriodId} showExport />
              </div>
            ) : (
              <Card><CardContent className="py-8 text-center text-muted-foreground">Select a fiscal period to view budget vs actual comparison.</CardContent></Card>
            )}
          </TabsContent>

          <TabsContent value="docs" className="mt-4">
            {ngoId && <FinanceDocsTab ngoId={ngoId} />}
          </TabsContent>
        </Tabs>

        {ngoId && (
          <CreateFiscalPeriodDialog open={createPeriodOpen} onOpenChange={setCreatePeriodOpen} ngoId={ngoId} />
        )}
      </div>
    </MainLayout>
  );
};

export default NGOFinancialOverview;
