import { useReconciliation } from "@/hooks/useReconciliation";
import { useTrialBalance } from "@/hooks/useTrialBalance";
import { useActuals } from "@/hooks/useActuals";
import { useBudgetCategories } from "@/hooks/useBudgetCategories";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircle2, AlertTriangle, Lock } from "lucide-react";

interface ReconciliationPanelProps {
  ngoId: string;
  fiscalPeriodId: string;
}

export function ReconciliationPanel({ ngoId, fiscalPeriodId }: ReconciliationPanelProps) {
  const { data: recon, upsert } = useReconciliation(ngoId, fiscalPeriodId);
  const { data: tbRows } = useTrialBalance(ngoId, fiscalPeriodId);
  const { data: actuals } = useActuals(ngoId, fiscalPeriodId);
  const { data: categories } = useBudgetCategories(ngoId);
  const { user } = useAuth();
  const { toast } = useToast();

  // Compute ledger totals from trial balance
  const ledgerIncome = (tbRows || []).filter((r) => r.account_type === "income").reduce((s, r) => s + r.total_credit - r.total_debit, 0);
  const ledgerExpense = (tbRows || []).filter((r) => r.account_type === "expense").reduce((s, r) => s + r.total_debit - r.total_credit, 0);

  // Compute actuals totals
  const catMap = new Map((categories || []).map((c) => [c.id, c.type]));
  let actualsIncome = 0, actualsExpense = 0;
  (actuals || []).forEach((a) => {
    const t = catMap.get(a.category_id);
    if (t === "income") actualsIncome += Number(a.amount);
    else if (t === "expense") actualsExpense += Number(a.amount);
  });

  const incomeDiff = Math.abs(ledgerIncome - actualsIncome);
  const expenseDiff = Math.abs(ledgerExpense - actualsExpense);
  const isMatched = incomeDiff < 0.01 && expenseDiff < 0.01;
  const status = recon?.status || "open";

  const handleClose = async () => {
    try {
      await upsert.mutateAsync({ ngo_id: ngoId, fiscal_period_id: fiscalPeriodId, status: "closed", reconciled_by_user_id: user?.id });
      toast({ title: "Period closed" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleReopen = async () => {
    try {
      await upsert.mutateAsync({ ngo_id: ngoId, fiscal_period_id: fiscalPeriodId, status: "open" });
      toast({ title: "Period reopened" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Reconciliation</CardTitle>
        <Badge variant={status === "closed" ? "default" : "secondary"} className="capitalize gap-1">
          {status === "closed" ? <Lock className="h-3 w-3" /> : null}
          {status}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div />
          <div className="font-medium text-center">Ledger</div>
          <div className="font-medium text-center">Actuals</div>

          <div className="font-medium">Income</div>
          <div className="text-center font-mono">{fmt(ledgerIncome)}</div>
          <div className="text-center font-mono">{fmt(actualsIncome)}</div>

          <div className="font-medium">Expense</div>
          <div className="text-center font-mono">{fmt(ledgerExpense)}</div>
          <div className="text-center font-mono">{fmt(actualsExpense)}</div>
        </div>

        {!isMatched && (
          <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            Mismatch detected — Income diff: {fmt(incomeDiff)}, Expense diff: {fmt(expenseDiff)}
          </div>
        )}

        {isMatched && status !== "closed" && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" /> Totals match
          </div>
        )}

        <div className="flex gap-2">
          {status !== "closed" ? (
            <Button size="sm" onClick={handleClose} disabled={!isMatched}>
              <Lock className="h-4 w-4 mr-1" /> Close Period
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={handleReopen}>Reopen</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
