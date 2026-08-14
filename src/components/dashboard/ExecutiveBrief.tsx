import { AlertCircle, CheckCircle2, ClipboardList, Loader2, Sparkles, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardData, type DashboardFilters } from "@/hooks/useDashboardData";
import { useDashboardDataHealth } from "@/hooks/useDashboardDataHealth";
import { DashboardPanelState } from "@/components/dashboard/DashboardPanelState";

const pluralize = (count: number, singular: string, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;

const buildAttentionSummary = (overdue: number, dueThisWeek: number, missingEvidence: number, atRisk: number) => {
  const parts = [];
  if (overdue > 0) parts.push(pluralize(overdue, "overdue item"));
  if (dueThisWeek > 0) parts.push(pluralize(dueThisWeek, "item") + " due this week");
  if (missingEvidence > 0) parts.push(pluralize(missingEvidence, "missing evidence item"));
  if (atRisk > 0) parts.push(pluralize(atRisk, "NGO") + " needing compliance attention");
  return parts.length ? parts.join(", ") : "No urgent dashboard issues are currently showing.";
};

export const ExecutiveBrief = ({ filters }: { filters: DashboardFilters }) => {
  const {
    data: dashboardData,
    isLoading: dashboardLoading,
    isError: dashboardError,
    refetch: refetchDashboard,
  } = useDashboardData(filters);
  const {
    data: healthData,
    isLoading: healthLoading,
    isError: healthError,
    refetch: refetchHealth,
  } = useDashboardDataHealth();

  if (dashboardLoading || healthLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (dashboardError || healthError) {
    return (
      <Card>
        <CardContent className="py-8">
          <DashboardPanelState
            isError
            errorMessage="Executive Brief could not load dashboard summary data."
            onRetry={() => void Promise.all([refetchDashboard(), refetchHealth()])}
          />
        </CardContent>
      </Card>
    );
  }

  const kpis = dashboardData?.kpis;
  const totalNgos = kpis?.totalNgos ?? 0;
  const overdue = kpis?.overdue ?? 0;
  const dueThisWeek = kpis?.dueIn7Days ?? 0;
  const missingEvidence = dashboardData?.evidencePending?.length ?? 0;
  const atRisk = dashboardData?.atRiskNgos?.length ?? 0;
  const busiestDepartment = dashboardData?.workloadByDepartment?.[0];
  const readiness = healthData?.readiness ?? 0;
  const liveSources = healthData?.connected ?? 0;
  const missingSources = healthData?.missing ?? 0;
  const attentionCount = overdue + dueThisWeek + missingEvidence + atRisk;

  const briefTone = attentionCount > 0 || missingSources > 0 ? "Needs attention" : "Stable";

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Executive Brief
          </CardTitle>
          <CardDescription>Plain-language command summary for the current dashboard view.</CardDescription>
        </div>
        <Badge variant={attentionCount > 0 || missingSources > 0 ? "destructive" : "default"}>{briefTone}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border bg-background/70 p-3">
            <p className="text-xs text-muted-foreground">Portfolio</p>
            <p className="mt-1 text-xl font-semibold">{totalNgos}</p>
            <p className="text-xs text-muted-foreground">NGOs in view</p>
          </div>
          <div className="rounded-lg border bg-background/70 p-3">
            <p className="text-xs text-muted-foreground">Attention</p>
            <p className="mt-1 text-xl font-semibold text-orange-500">{attentionCount}</p>
            <p className="text-xs text-muted-foreground">combined alerts</p>
          </div>
          <div className="rounded-lg border bg-background/70 p-3">
            <p className="text-xs text-muted-foreground">Data readiness</p>
            <p className="mt-1 text-xl font-semibold">{readiness}%</p>
            <p className="text-xs text-muted-foreground">dashboard sources</p>
          </div>
          <div className="rounded-lg border bg-background/70 p-3">
            <p className="text-xs text-muted-foreground">Live systems</p>
            <p className="mt-1 text-xl font-semibold text-green-600">{liveSources}</p>
            <p className="text-xs text-muted-foreground">sources with records</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border bg-background/70 p-3">
            <p className="flex items-center gap-2 text-sm font-medium"><AlertCircle className="h-4 w-4 text-orange-500" /> Action summary</p>
            <p className="mt-1 text-sm text-muted-foreground">{buildAttentionSummary(overdue, dueThisWeek, missingEvidence, atRisk)}</p>
          </div>
          <div className="rounded-lg border bg-background/70 p-3">
            <p className="flex items-center gap-2 text-sm font-medium"><TrendingUp className="h-4 w-4 text-primary" /> Workload signal</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {busiestDepartment ? `${busiestDepartment.department} currently has the highest visible workload with ${pluralize(busiestDepartment.count, "open item")}.` : "No department workload is currently visible."}
            </p>
          </div>
          <div className="rounded-lg border bg-background/70 p-3">
            <p className="flex items-center gap-2 text-sm font-medium"><CheckCircle2 className="h-4 w-4 text-green-600" /> System signal</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {missingSources > 0 ? `${pluralize(missingSources, "data source")} still need schema/build attention.` : "All tracked dashboard sources are reachable or empty-but-ready."}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
