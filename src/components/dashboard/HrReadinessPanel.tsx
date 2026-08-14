import { useMemo } from "react";
import { GraduationCap, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardDataHealth, type DataHealthItem } from "@/hooks/useDashboardDataHealth";
import { useQuery } from "@tanstack/react-query";
import { ensureSupabase } from "@/integrations/supabase/client";
import { DashboardPanelState } from "@/components/dashboard/DashboardPanelState";
import { createDashboardRequestScope } from "@/lib/dashboardRequest";

const HR_TABLES = ["staff_profiles", "applicants", "timesheets"];

const recommendAction = (items: DataHealthItem[]) => {
  const missing = items.filter((item) => item.status === "missing");
  const empty = items.filter((item) => item.status === "empty");

  if (missing.some((item) => item.table === "staff_profiles")) {
    return "Connect staff profiles schema before rolling out HR workflows.";
  }
  if (empty.some((item) => item.table === "staff_profiles")) {
    return "Add staff profiles to establish the HR roster foundation.";
  }
  if (empty.some((item) => item.table === "applicants")) {
    return "Start capturing applicants to activate recruiting workflows.";
  }
  if (empty.some((item) => item.table === "timesheets")) {
    return "Enable timesheet entry once staff profiles are in place.";
  }
  return "HR sources are connected. Continue onboarding staff and tracking time.";
};

export const HrReadinessPanel = () => {
  const {
    data: healthData,
    isLoading: healthLoading,
    isError: healthError,
    refetch: refetchHealth,
  } = useDashboardDataHealth();

  const {
    data: hrWorkItems,
    isLoading: workItemsLoading,
    isError: workItemsError,
    refetch: refetchWorkItems,
  } = useQuery({
    queryKey: ["dashboard-hr-work-items"],
    queryFn: async ({ signal }) => {
      const supabase = ensureSupabase();
      const request = createDashboardRequestScope(signal);

      try {
        const { count, error } = await supabase
          .from("work_items")
          .select("id", { count: "exact", head: true })
          .is("archived_at", null)
          .eq("module", "hr")
          .abortSignal(request.signal);
        if (error) throw error;
        return count ?? 0;
      } finally {
        request.cleanup();
      }
    },
  });

  const hrItems = useMemo(
    () => (healthData?.items ?? []).filter((item) => HR_TABLES.includes(item.table)),
    [healthData?.items],
  );

  const isLoading = healthLoading || workItemsLoading;
  const nextAction = recommendAction(hrItems);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-primary" />
          HR Readiness
        </CardTitle>
        <CardDescription>Implementation status for staff, applicants, timesheets, and HR tasks.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : healthError || workItemsError ? (
          <DashboardPanelState
            isError
            errorMessage="HR readiness could not load."
            onRetry={() => void Promise.all([refetchHealth(), refetchWorkItems()])}
          />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {hrItems.map((item) => (
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
                <p className="text-xs text-muted-foreground">HR work items</p>
                <p className="mt-2 text-xl font-semibold">{hrWorkItems ?? "—"}</p>
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
