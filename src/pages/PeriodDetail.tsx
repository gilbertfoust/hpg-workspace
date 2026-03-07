import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { PeriodSummaryCard } from "@/components/finance/PeriodSummaryCard";
import { BudgetActualTable } from "@/components/finance/BudgetActualTable";
import { ReviewPanel } from "@/components/finance/ReviewPanel";
import { ActualsImportDialog } from "@/components/finance/ActualsImportDialog";
import { CreateBudgetCategoryDialog } from "@/components/finance/CreateBudgetCategoryDialog";
import { useFiscalPeriods } from "@/hooks/useFiscalPeriods";
import { useFinancialReviewStatus } from "@/hooks/useFinancialReviewStatus";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ChevronRight, Upload, Plus } from "lucide-react";
import { TransactionsTable } from "@/components/finance/TransactionsTable";
import { useTransactions } from "@/hooks/useTransactions";
import { ReconciliationPanel } from "@/components/finance/ReconciliationPanel";

const PeriodDetail = () => {
  const { ngoId, periodId } = useParams<{ ngoId: string; periodId: string }>();
  const [importOpen, setImportOpen] = useState(false);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);

  const { data: ngo, isLoading: ngoLoading } = useQuery({
    queryKey: ["ngo_detail", ngoId],
    enabled: !!ngoId,
    queryFn: async () => {
      const { data, error } = await supabase.from("ngos").select("*").eq("id", ngoId!).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: periods, isLoading: periodLoading } = useFiscalPeriods(ngoId);
  const period = periods?.find((p) => p.id === periodId);

  const { data: reviews } = useFinancialReviewStatus(ngoId, periodId);
  const reviewStatus = reviews?.[0]?.status || "not_started";

  // Get actuals for summary
  const { data: categories } = useQuery({
    queryKey: ["budget_categories_types"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("budget_categories").select("id, type");
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: actuals } = useQuery({
    queryKey: ["actuals", ngoId, periodId],
    enabled: !!ngoId && !!periodId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("actuals").select("*").eq("ngo_id", ngoId!).eq("fiscal_period_id", periodId!);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const catTypeMap = new Map((categories || []).map((c: any) => [c.id, c.type]));
  let totalIncome = 0, totalExpense = 0;
  (actuals || []).forEach((a: any) => {
    const t = catTypeMap.get(a.category_id);
    if (t === "income") totalIncome += Number(a.amount);
    else if (t === "expense") totalExpense += Number(a.amount);
  });

  if (ngoLoading || periodLoading) {
    return <MainLayout><div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div></MainLayout>;
  }

  if (!period) {
    return <MainLayout><div className="p-6 text-center text-muted-foreground">Period not found.</div></MainLayout>;
  }

  return (
    <MainLayout>
      <div className="space-y-6 p-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <Link to="/financial-hub" className="hover:text-foreground">Financial Hub</Link>
          <ChevronRight className="h-4 w-4" />
          <Link to={`/financial-hub/ngo/${ngoId}`} className="hover:text-foreground">{ngo?.common_name || ngo?.legal_name}</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">{period.label}</span>
        </div>

        {/* Period summary */}
        <PeriodSummaryCard
          label={period.label}
          periodType={period.period_type}
          startDate={period.start_date}
          endDate={period.end_date}
          currency={period.currency_code}
          totalIncome={totalIncome}
          totalExpense={totalExpense}
          reviewStatus={reviewStatus}
        />

        {/* Budget vs Actual editor */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Budget vs Actual</h2>
            {ngoId && periodId && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setAddCategoryOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Add Category
                </Button>
                <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                  <Upload className="h-4 w-4 mr-1" /> Import CSV
                </Button>
              </div>
            )}
          </div>
          {ngoId && periodId && (
            <BudgetActualTable ngoId={ngoId} fiscalPeriodId={periodId} editable currency={period.currency_code || "USD"} showExport exportFileName={`BvA-${ngo?.common_name || ngo?.legal_name}-${period.label}`.replace(/\s+/g, "_")} />
          )}
        </div>

        {ngoId && periodId && (
          <ActualsImportDialog open={importOpen} onOpenChange={setImportOpen} ngoId={ngoId} fiscalPeriodId={periodId} />
        )}
        {ngoId && (
          <CreateBudgetCategoryDialog open={addCategoryOpen} onOpenChange={setAddCategoryOpen} ngoId={ngoId} />
        )}

        {/* Raw Transactions */}
        {ngoId && periodId && (
          <div>
            <h2 className="text-lg font-semibold mb-3">Raw Transactions</h2>
            <PeriodTransactions ngoId={ngoId} fiscalPeriodId={periodId} />
          </div>
        )}

        {/* Reconciliation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            {ngoId && periodId && <ReviewPanel ngoId={ngoId} fiscalPeriodId={periodId} />}
          </div>
          <div>
            {ngoId && periodId && <ReconciliationPanel ngoId={ngoId} fiscalPeriodId={periodId} />}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

function PeriodTransactions({ ngoId, fiscalPeriodId }: { ngoId: string; fiscalPeriodId: string }) {
  const { data: transactions, isLoading } = useTransactions(ngoId, fiscalPeriodId);
  return <TransactionsTable transactions={transactions || []} isLoading={isLoading} />;
}

export default PeriodDetail;
