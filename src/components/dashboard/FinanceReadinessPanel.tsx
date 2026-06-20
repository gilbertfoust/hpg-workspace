import { useMemo } from "react";
import { DollarSign, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardDataHealth, type DataHealthItem } from "@/hooks/useDashboardDataHealth";
import { useQuery } from "@tanstack/react-query";
import { ensureSupabase } from "@/integrations/supabase/client";

const FINANCE_TABLES = ["accounts", "transactions", "journal_entries"];

const recommendAction = (items: DataHealthItem[]) => {
  const missing = items.filter((item) => item.status === "missing");
  const empty = items.filter((item) => item.status === "empty");

  if (missing.some((item) => item.table === "accounts")) {
    return "Build or connect the chart of accounts before importing transactions.";
  }
  if (empty.some((item) => item.table === "accounts")) {
    return "Create chart of accounts records to establish the finance foundation.";
  }
  if (empty.some((item) => item.table === "journal_entries")) {
    return "Start recording journal entries once accounts are in place.";
  }
  if (empty.some((item) => item.table === "transactions")) {
    return "Import or enter transactions to activate bookkeeping workflows.";
  }
  return "Finance sources are connected. Continue posting entries and reconciling accounts.";
};

export const FinanceReadinessPanel = () => {
  const { data: healthData, isLoading: healthLoading } = useDashboardDataHealth();

  const { data: financeWorkItems, isLoading: workItemsLoading } = useQuery({
    queryKey: ["dashboard-finance-work-items"],
    queryFn: async () => {
      const supabase = ensureSupabase();
      const { count, error } = await supabase
        .from("work_items")
        .select("id", { count: "exact", head: true })
        .is("archived_at", null)
        .eq("module", "finance");
      if (error) return null;
      return count ?? 0;
    },
  });

  const financeItems = useMemo(
    () => (healthData?.items ?? []).filter((item) => FINANCE_TABLES.includes(item.table)),
    [healthData?.items],
  );

  const isLoading = healthLoading || workItemsLoading;
  const nextAction = recommendAction(financeItems);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" />
          Finance Readiness
        </CardTitle>
        <CardDescription>What is live, empty, or missing for bookkeeping and finance operations.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {financeItems.map((item) => (
                <div key={item.table} className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <Badge variant={item.status === "connected" ? "default" : item.status === "empty" ? "secondary" : "destructive"}>
                      {item.status === "connected" ? "Live" : item.status === "empty" ? "Empty" : "Missing"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {item.count === null ? "—" : `${item.count}`}
                    </span>
                  </div>
                </div>
              ))}
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Finance work items</p>
                <p className="mt-2 text-xl font-semibold">{financeWorkItems ?? "—"}</p>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Recommended next action: </span>
              {nextAction}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
