import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  LayoutDashboard,
  Building2,
  ClipboardList,
  FileText,
  Calendar as CalendarIcon,
  ArrowRight,
  Users,
  AlertCircle,
  Clock,
  DollarSign,
  TrendingUp,
  Briefcase,
  Shield,
  Filter,
  Printer,
  Presentation,
  RefreshCw,
} from "lucide-react";
import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area,
} from "recharts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDashboardData, useDashboardFilters, type DashboardFilters } from "@/hooks/useDashboardData";
import { useNGOStats } from "@/hooks/useNGOs";
import { Loader2 } from "lucide-react";
import { format, subMonths, startOfMonth } from "date-fns";
import { TodaysActionCenter } from "@/components/dashboard/TodaysActionCenter";
import { ModuleSnapshotCards } from "@/components/dashboard/ModuleSnapshotCards";
import { RecentActivityFeed } from "@/components/dashboard/RecentActivityFeed";
import { DataHealthPanel } from "@/components/dashboard/DataHealthPanel";
import { ExecutiveBrief } from "@/components/dashboard/ExecutiveBrief";
import { DashboardAlertsBanner } from "@/components/dashboard/DashboardAlertsBanner";
import { DashboardFollowUpQueue } from "@/components/dashboard/DashboardFollowUpQueue";
import { NgoPortfolioIntelligencePanel } from "@/components/dashboard/NgoPortfolioIntelligencePanel";
import { GrantPipelineIntelligencePanel } from "@/components/dashboard/GrantPipelineIntelligencePanel";
import { FinanceReadinessPanel } from "@/components/dashboard/FinanceReadinessPanel";
import { HrReadinessPanel } from "@/components/dashboard/HrReadinessPanel";
import { DashboardDataDefinitions } from "@/components/dashboard/DashboardDataDefinitions";
import { DashboardPanelState } from "@/components/dashboard/DashboardPanelState";
import { DashboardChartFrame } from "@/components/dashboard/DashboardChartFrame";
import { SavedDashboardViews } from "@/components/dashboard/SavedDashboardViews";
import { useSavedDashboardViews, type SavedDashboardView } from "@/hooks/useSavedDashboardViews";
import { useDashboardSectionScroll, useDashboardUrlState, type DashboardSectionId } from "@/hooks/useDashboardUrlState";
import { toDashboardSearchParams } from "@/lib/dashboardSearchParams";
import { ensureSupabase } from "@/integrations/supabase/client";
import { createDashboardRequestScope } from "@/lib/dashboardRequest";

const HPG_LOGO_URL =
  "https://img1.wsimg.com/isteam/ip/8d5502d6-d937-4d80-bd56-8074053e4d77/Humanity%20Pathways%20Global.jpg/:/rs=h:175,m";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(210, 70%, 55%)",
  "hsl(150, 60%, 45%)",
  "hsl(40, 80%, 55%)",
  "hsl(340, 65%, 50%)",
  "hsl(270, 50%, 55%)",
  "hsl(190, 60%, 45%)",
];

const HOME_DASHBOARD_QUERY_ROOTS = new Set([
  "dashboard-action-center",
  "dashboard-alerts",
  "dashboard-data",
  "dashboard-data-health",
  "dashboard-filters",
  "dashboard-grant-pipeline",
  "dashboard-hr-work-items",
  "dashboard-module-snapshots",
  "dashboard-portfolio-intelligence",
  "dashboard-recent-activity",
  "dashboard-work-item-activity",
  "finance-hub-snapshot",
  "finance-readiness-tables",
  "ngo-stats",
  "reminders",
]);

const hasActiveFilters = (filters: DashboardFilters) =>
  Boolean(filters.bundle || filters.country || filters.state || filters.module);

function useWorkItemTrend(filters: DashboardFilters) {
  const query = useDashboardWorkItemActivity(filters);
  const workItems = query.data;
  const months: { month: string; created: number; completed: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const start = startOfMonth(subMonths(now, i));
    const label = format(start, "MMM");
    const nextMonth = startOfMonth(subMonths(now, i - 1));
    const created = workItems?.filter(wi => {
      if (!wi.created_at) return false;
      const d = new Date(wi.created_at);
      return d >= start && d < nextMonth;
    }).length ?? 0;
    const completed = workItems?.filter(wi => {
      if (!["complete", "approved"].includes(String(wi.status ?? "").toLowerCase())) return false;
      if (!wi.updated_at) return false;
      const d = new Date(wi.updated_at);
      return d >= start && d < nextMonth;
    }).length ?? 0;
    months.push({ month: label, created, completed });
  }
  return { ...query, trendData: months };
}

function useStatusDistribution(filters: DashboardFilters) {
  const query = useDashboardWorkItemActivity(filters);
  const workItems = query.data;
  const statusMap = new Map<string, number>();
  workItems?.forEach(wi => {
    const s = String(wi.status || "Unassigned").replace(/_/g, " ");
    statusMap.set(s, (statusMap.get(s) ?? 0) + 1);
  });
  return {
    ...query,
    statusData: Array.from(statusMap.entries()).map(([name, value]) => ({ name, value })),
  };
}

function useDashboardWorkItemActivity(filters: DashboardFilters) {
  return useQuery({
    queryKey: ["dashboard-work-item-activity", filters.module ?? null],
    queryFn: async ({ signal }) => {
      const request = createDashboardRequestScope(signal);

      try {
        let workItemsQuery = ensureSupabase()
          .from("work_items")
          .select("status, created_at, updated_at")
          .is("archived_at", null);

        if (filters.module) {
          workItemsQuery = workItemsQuery.eq("module", filters.module);
        }

        const { data, error } = await workItemsQuery.abortSignal(request.signal);
        if (error) throw error;
        return data ?? [];
      } finally {
        request.cleanup();
      }
    },
  });
}

const DashboardFilterControls = ({
  filters,
  setFilters,
  section,
  onApplySavedView,
  onResetView,
}: {
  filters: DashboardFilters;
  setFilters: (filters: DashboardFilters) => void;
  section: DashboardSectionId | null;
  onApplySavedView: (view: SavedDashboardView) => void;
  onResetView: () => void;
}) => {
  const { data: options, isLoading, isError, refetch } = useDashboardFilters();

  const updateFilter = (key: keyof DashboardFilters, value: string) => {
    setFilters({
      ...filters,
      [key]: value || undefined,
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            Dashboard Filters
          </CardTitle>
          <CardDescription>Focus dashboard data by portfolio, location, or module.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => setFilters({})} disabled={!hasActiveFilters(filters)}>
          Reset filters
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <DashboardPanelState
            isError
            errorMessage="Dashboard filters could not load. The current unfiltered view remains available."
            onRetry={() => void refetch()}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              Bundle
              <select className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground" value={filters.bundle || ""} onChange={(event) => updateFilter("bundle", event.target.value)}>
                <option value="">All bundles</option>
                {(options?.bundles ?? []).map((bundle) => <option key={bundle} value={bundle}>{bundle}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              Country
              <select className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground" value={filters.country || ""} onChange={(event) => updateFilter("country", event.target.value)}>
                <option value="">All countries</option>
                {(options?.countries ?? []).map((country) => <option key={country} value={country}>{country}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              State / Province
              <select className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground" value={filters.state || ""} onChange={(event) => updateFilter("state", event.target.value)}>
                <option value="">All states</option>
                {(options?.states ?? []).map((state) => <option key={state} value={state}>{state}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              Module
              <select className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground" value={filters.module || ""} onChange={(event) => updateFilter("module", event.target.value)}>
                <option value="">All modules</option>
                {(options?.modules ?? []).map((module) => <option key={module} value={module}>{module}</option>)}
              </select>
            </label>
          </div>
        )}
        <SavedDashboardViews
          filters={filters}
          section={section}
          onApply={onApplySavedView}
          onReset={onResetView}
        />
      </CardContent>
    </Card>
  );
};

const DashboardDrilldowns = ({ filters }: { filters: DashboardFilters }) => {
  const navigate = useNavigate();
  const baseParams = {
    bundle: filters.bundle,
    country: filters.country,
    state: filters.state,
    module: filters.module,
  };

  const drilldowns = [
    { label: "Overdue Work Items", path: `/work-items${toDashboardSearchParams({ ...baseParams, due: "overdue" })}`, icon: AlertCircle },
    { label: "Due This Week", path: `/work-items${toDashboardSearchParams({ ...baseParams, due: "7d" })}`, icon: Clock },
    { label: "High Priority", path: `/work-items${toDashboardSearchParams({ ...baseParams, priority: "high" })}`, icon: TrendingUp },
    { label: "Waiting on NGO", path: `/work-items${toDashboardSearchParams({ ...baseParams, status: "waiting_on_ngo" })}`, icon: Users },
    { label: "Out of Compliance NGOs", path: `/ngos${toDashboardSearchParams({ ...baseParams, portfolioStatus: "out_of_compliance" })}`, icon: Shield },
    { label: "Grant Applications", path: `/grants${toDashboardSearchParams({ ...baseParams, view: "applications" })}`, icon: Briefcase },
    { label: "Pending Documents", path: `/documents${toDashboardSearchParams({ ...baseParams, review_status: "Pending" })}`, icon: FileText },
    { label: "Data Health", path: `/dashboard${toDashboardSearchParams({ ...baseParams, section: "data-health" })}`, icon: LayoutDashboard },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Dashboard Drilldowns</CardTitle>
        <CardDescription>Jump from the dashboard into focused queues and filtered workspace views.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {drilldowns.map((item) => (
            <Button key={item.label} variant="outline" className="justify-between" onClick={() => navigate(item.path)}>
              <span className="flex items-center gap-2">
                <item.icon className="h-4 w-4" />
                {item.label}
              </span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const DashboardKPIs = ({ filters }: { filters: DashboardFilters }) => {
  const {
    data: dashboardData,
    isLoading: dashboardLoading,
    isError: dashboardError,
    refetch: refetchDashboard,
  } = useDashboardData(filters);
  const {
    data: ngoStats,
    isLoading: ngoStatsLoading,
    isError: ngoStatsError,
    refetch: refetchNgoStats,
  } = useNGOStats();

  if (dashboardLoading || ngoStatsLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardContent className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (dashboardError || ngoStatsError) {
    return (
      <Card>
        <CardContent className="py-6">
          <DashboardPanelState
            isError
            errorMessage="Dashboard totals could not load."
            onRetry={() => void Promise.all([refetchDashboard(), refetchNgoStats()])}
          />
        </CardContent>
      </Card>
    );
  }

  const totalNgoCount = hasActiveFilters(filters) ? dashboardData?.kpis?.totalNgos || 0 : dashboardData?.kpis?.totalNgos || ngoStats?.total || 0;
  const overdueCount = dashboardData?.kpis?.overdue || 0;
  const dueIn7Days = dashboardData?.kpis?.dueIn7Days || 0;
  const totalWorkItems = dashboardData?.openWorkItemCount ?? 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Total NGO Portfolio</CardTitle>
          <Building2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{totalNgoCount}</p>
          <p className="text-xs text-muted-foreground">{hasActiveFilters(filters) ? "Filtered portfolio" : "Everyone in the NGO pipeline"}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Overdue Items</CardTitle>
          <AlertCircle className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-destructive">{overdueCount}</p>
          <p className="text-xs text-muted-foreground">Past due date</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Due This Week</CardTitle>
          <Clock className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-orange-500">{dueIn7Days}</p>
          <p className="text-xs text-muted-foreground">Next 7 days</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Total Work Items</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{totalWorkItems.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Active visible work items</p>
        </CardContent>
      </Card>
    </div>
  );
};

const WorkItemTrendChart = ({ filters }: { filters: DashboardFilters }) => {
  const { trendData, isLoading, isError, refetch } = useWorkItemTrend(filters);
  const activityTotal = trendData.reduce((total, month) => total + month.created + month.completed, 0);

  return (
    <DashboardChartFrame
      title="Work Item Trend"
      description="Created vs completed — last 6 months"
      isLoading={isLoading}
      isError={isError}
      isEmpty={!isLoading && !isError && activityTotal === 0}
      onRetry={() => void refetch()}
      emptyTitle="No work-item activity in the last six months"
      emptyDescription="New and completed work items will populate this trend automatically."
      accessibleSummary={`Work item activity over six months: ${trendData.map((month) => `${month.month}, ${month.created} created and ${month.completed} completed`).join("; ")}.`}
      fallbackItems={trendData.flatMap((month) => [
        { label: `${month.month} created`, value: month.created },
        { label: `${month.month} completed`, value: month.completed },
      ])}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={trendData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="month" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
          <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
          <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
          <Area type="monotone" dataKey="created" stackId="1" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} name="Created" />
          <Area type="monotone" dataKey="completed" stackId="2" stroke="hsl(150, 60%, 45%)" fill="hsl(150, 60%, 45%)" fillOpacity={0.3} name="Completed" />
        </AreaChart>
      </ResponsiveContainer>
    </DashboardChartFrame>
  );
};

const StatusDistributionChart = ({ filters }: { filters: DashboardFilters }) => {
  const { statusData, isLoading, isError, refetch } = useStatusDistribution(filters);

  return (
    <DashboardChartFrame
      title="Status Distribution"
      description="Active work items by status"
      isLoading={isLoading}
      isError={isError}
      isEmpty={!isLoading && !isError && statusData.length === 0}
      onRetry={() => void refetch()}
      emptyTitle="No active work items"
      emptyDescription="Active work-item statuses will appear here."
      accessibleSummary={`Active work items by status: ${statusData.map((item) => `${item.name}, ${item.value}`).join("; ")}.`}
      fallbackItems={statusData.map((item) => ({ label: item.name, value: item.value }))}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} (${(Number(percent ?? 0) * 100).toFixed(0)}%)`} labelLine={false}>
            {statusData.map((_, index) => (
              <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </DashboardChartFrame>
  );
};

const NgoPortfolioStatusChart = ({ filters }: { filters: DashboardFilters }) => {
  const { data: dashboardData, isLoading, isError, refetch } = useDashboardData(filters);
  const portfolioData = dashboardData?.ngoStatusDistribution?.filter((item) => item.value > 0) ?? [];

  return (
    <DashboardChartFrame
      title="NGO Portfolio Status"
      description="Where everyone stands in the HPG relationship pipeline"
      isLoading={isLoading}
      isError={isError}
      isEmpty={!isLoading && !isError && portfolioData.length === 0}
      onRetry={() => void refetch()}
      emptyTitle="No NGO portfolio data"
      emptyDescription="Add NGOs to the workspace to see portfolio status distribution."
      accessibleSummary={`NGO portfolio status: ${portfolioData.map((item) => `${item.name}, ${item.value}`).join("; ")}.`}
      fallbackItems={portfolioData.map((item) => ({ label: item.name, value: item.value }))}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={portfolioData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} (${(Number(percent ?? 0) * 100).toFixed(0)}%)`} labelLine={false}>
            {portfolioData.map((_, index) => (
              <Cell key={index} fill={CHART_COLORS[(index + 2) % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </DashboardChartFrame>
  );
};

const DeptWorkloadChart = ({ filters }: { filters: DashboardFilters }) => {
  const { data: dashboardData, isLoading, isError, refetch } = useDashboardData(filters);
  const workload = dashboardData?.workloadByDepartment ?? [];
  const openCount = dashboardData?.openWorkItemCount ?? 0;

  return (
    <DashboardChartFrame
      className="col-span-full"
      title="Workload by Department"
      description="Open work items per department (includes module-based routing when department is unset)"
      isLoading={isLoading}
      isError={isError}
      isEmpty={!isLoading && !isError && workload.length === 0}
      onRetry={() => void refetch()}
      emptyTitle={openCount > 0 ? "Work items found without department grouping" : "No open work items in this view"}
      emptyDescription={
        openCount > 0
          ? `${openCount} open work item${openCount === 1 ? "" : "s"} exist but could not be grouped by department. Assign a department on each work item for clearer workload charts.`
          : "Create or reopen work items in this dashboard view to see department workload."
      }
      accessibleSummary={`Open work items by department: ${workload.map((item) => `${item.department}, ${item.count}`).join("; ")}.`}
      fallbackItems={workload.map((item) => ({ label: item.department, value: item.count }))}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={workload} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))" }} />
          <YAxis dataKey="department" type="category" width={120} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
          <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Open Items" />
        </BarChart>
      </ResponsiveContainer>
    </DashboardChartFrame>
  );
};

const AtRiskAndEvidencePanel = ({ filters }: { filters: DashboardFilters }) => {
  const { data: dashboardData, isLoading, isError, refetch } = useDashboardData(filters);
  const navigate = useNavigate();
  const evidenceRows = dashboardData?.evidencePending ?? [];
  const evidenceSummary = dashboardData?.evidenceSummary;
  const attentionCount = evidenceRows.length;
  const openCount = dashboardData?.openWorkItemCount ?? 0;

  const evidenceBadgeVariant = (category: string): "default" | "secondary" | "destructive" | "outline" => {
    if (category === "missing") return "destructive";
    if (category === "rejected") return "destructive";
    if (category === "under_review") return "default";
    return "secondary";
  };

  if (isLoading || isError) {
    return (
      <Card className="md:col-span-2">
        <CardContent className="py-8">
          <DashboardPanelState
            isLoading={isLoading}
            isError={isError}
            errorMessage="Portfolio risk and evidence records could not load."
            onRetry={() => void refetch()}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-destructive" />
            At-Risk NGOs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dashboardData?.atRiskNgos && dashboardData.atRiskNgos.length > 0 ? (
            <div className="space-y-2">
              {dashboardData.atRiskNgos.slice(0, 8).map((ngo) => (
                <div key={ngo.id} className="flex items-center justify-between p-2 border rounded text-sm cursor-pointer hover:bg-accent/50" onClick={() => navigate(`/ngos/${ngo.id}`)}>
                  <div>
                    <p className="font-medium">{ngo.name}</p>
                    <p className="text-xs text-muted-foreground">{ngo.location}</p>
                  </div>
                  {ngo.bundle && <Badge variant="outline" className="text-xs">{ngo.bundle}</Badge>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">No at-risk NGOs in the current view.</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-orange-500" />
            Evidence Status ({attentionCount} need attention)
          </CardTitle>
          <CardDescription>
            {openCount > 0
              ? "Tracks work items with evidence requirements in the current dashboard view."
              : "No open work items in the current view to evaluate for evidence."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {evidenceSummary && openCount > 0 && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded border p-2"><span className="text-muted-foreground">Missing</span><p className="font-semibold text-destructive">{evidenceSummary.missing}</p></div>
              <div className="rounded border p-2"><span className="text-muted-foreground">Pending review</span><p className="font-semibold">{evidenceSummary.uploadedPendingReview + evidenceSummary.underReview}</p></div>
              <div className="rounded border p-2"><span className="text-muted-foreground">Rejected</span><p className="font-semibold text-destructive">{evidenceSummary.rejected}</p></div>
              <div className="rounded border p-2"><span className="text-muted-foreground">Up to date / N/A</span><p className="font-semibold text-green-600">{evidenceSummary.upToDate + evidenceSummary.noEvidenceRequired}</p></div>
            </div>
          )}

          {attentionCount > 0 ? (
            <div className="space-y-2">
              {evidenceRows.slice(0, 8).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 p-2 border rounded text-sm cursor-pointer hover:bg-accent/50"
                  onClick={() => navigate(`/work-items?highlight=${item.id}`)}
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{item.ngoName}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.department}</p>
                    <p className="text-xs text-muted-foreground">{item.evidenceLabel}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant={evidenceBadgeVariant(item.evidenceCategory)} className="text-[10px]">
                      {item.evidenceCategory.replace(/_/g, " ")}
                    </Badge>
                    {item.dueDate && (
                      <Badge variant="outline" className="text-[10px]">
                        {new Date(item.dueDate).toLocaleDateString()}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
              {attentionCount > 8 && (
                <p className="text-xs text-muted-foreground text-center">+{attentionCount - 8} more</p>
              )}
            </div>
          ) : openCount === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Evidence tracking will appear when open work items exist in this dashboard view.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">
              All evidence is up to date, or no work items in this view require evidence.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const QuickNavCards = () => {
  const navigate = useNavigate();
  const cards = [
    { title: "NGOs", desc: "Browse sponsored NGOs", icon: Building2, path: "/ngos" },
    { title: "Work Items", desc: "Track tasks and follow-ups", icon: ClipboardList, path: "/work-items" },
    { title: "Financial Hub", desc: "Budgets, ledger, compliance", icon: DollarSign, path: "/financial-hub" },
    { title: "Forms", desc: "Dynamic templates & check-ins", icon: FileText, path: "/forms" },
    { title: "Grants", desc: "Applications & pipeline", icon: Briefcase, path: "/grants" },
    { title: "Calendar", desc: "Activities and deadlines", icon: CalendarIcon, path: "/calendar" },
    { title: "Reports", desc: "Dashboards & exports", icon: TrendingUp, path: "/reports" },
    { title: "Controller", desc: "Cross-NGO oversight", icon: Shield, path: "/controller" },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {cards.map(c => (
        <Card key={c.path} className="cursor-pointer hover:border-primary/60 transition-colors" onClick={() => navigate(c.path)}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-md bg-primary/10 p-2">
              <c.icon className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">{c.title}</p>
              <p className="text-xs text-muted-foreground">{c.desc}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [logoFailed, setLogoFailed] = useState(false);
  const [boardBriefMode, setBoardBriefMode] = useState(false);
  const { filters, section, setFilters, applyView, resetToDefault } = useDashboardUrlState();
  const { toFilters } = useSavedDashboardViews();
  useDashboardSectionScroll(section);
  const dashboardRequestsInFlight = useIsFetching({
    predicate: (query) => HOME_DASHBOARD_QUERY_ROOTS.has(String(query.queryKey[0] ?? "")),
  });

  const handleApplySavedView = (view: SavedDashboardView) => {
    applyView({ filters: toFilters(view), section: view.section ?? null });
  };
  const filterSummary = useMemo(() => {
    const entries = Object.entries(filters).filter(([, value]) => Boolean(value));
    return entries.length ? entries.map(([key, value]) => `${key}: ${value}`).join(" • ") : "All workspace data";
  }, [filters]);

  const handlePrintBoardBrief = () => {
    document.body.classList.add("dashboard-print-mode");
    window.print();
    window.setTimeout(() => document.body.classList.remove("dashboard-print-mode"), 500);
  };

  const handleRefreshDashboard = async () => {
    const predicate = (query: { queryKey: readonly unknown[] }) =>
      HOME_DASHBOARD_QUERY_ROOTS.has(String(query.queryKey[0] ?? ""));
    await queryClient.cancelQueries({ predicate });
    await queryClient.invalidateQueries({ predicate });
  };

  return (
    <MainLayout>
    <div className="space-y-4 sm:space-y-6 dashboard-page min-w-0 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between dashboard-no-print">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-md border bg-background/60">
              {logoFailed ? (
                <LayoutDashboard className="w-5 h-5 text-primary" />
              ) : (
                <img
                  src={HPG_LOGO_URL}
                  alt="Humanity Pathways Global"
                  className="h-full w-full object-contain p-0.5"
                  onError={() => setLogoFailed(true)}
                />
              )}
            </span>
            {boardBriefMode ? "HPG Board Brief" : "HPG Workspace"}
          </h1>
          <p className="text-muted-foreground">
            {boardBriefMode
              ? "Leadership summary for board review and print export."
              : "Overview of NGOs, work items, finances, and compliance across Humanity Pathways Global."}
          </p>
          {!boardBriefMode && (
            <p className="mt-1 text-xs text-muted-foreground">Current view: {filterSummary}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void handleRefreshDashboard()}>
            {dashboardRequestsInFlight > 0 ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh data
          </Button>
          <Button
            variant={boardBriefMode ? "default" : "outline"}
            onClick={() => setBoardBriefMode((v) => !v)}
          >
            <Presentation className="w-4 h-4 mr-2" />
            Board Brief Mode
          </Button>
          {boardBriefMode && (
            <Button variant="outline" onClick={handlePrintBoardBrief}>
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
          )}
          {!boardBriefMode && (
            <>
              <Button variant="outline" onClick={() => navigate("/ngos")}>
                <Users className="w-4 h-4 mr-2" />
                View NGOs
              </Button>
              <Button onClick={() => navigate("/work-items")}>
                Open Work Queue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </>
          )}
        </div>
      </div>

      {!boardBriefMode && <DashboardAlertsBanner filters={filters} />}

      {/* Dashboard Filters */}
      {!boardBriefMode && (
      <section id="filters" className="scroll-mt-20">
        <DashboardFilterControls
          filters={filters}
          setFilters={setFilters}
          section={section}
          onApplySavedView={handleApplySavedView}
          onResetView={resetToDefault}
        />
      </section>
      )}

      {/* Charts — directly under filters */}
      {!boardBriefMode && (
      <section id="charts" className="scroll-mt-20 grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        <WorkItemTrendChart filters={filters} />
        <NgoPortfolioStatusChart filters={filters} />
        <StatusDistributionChart filters={filters} />
      </section>
      )}

      {/* Drilldowns */}
      {!boardBriefMode && (
      <section id="drilldowns" className="dashboard-operational">
        <DashboardDrilldowns filters={filters} />
      </section>
      )}

      {/* Executive Brief */}
      <section id="executive-brief">
        <ExecutiveBrief filters={filters} />
      </section>

      {/* KPI Row */}
      <section id="kpis">
        <DashboardKPIs filters={filters} />
      </section>

      {/* Today's Action Center */}
      {!boardBriefMode && (
      <section id="action-center" className="dashboard-operational">
        <TodaysActionCenter filters={filters} />
      </section>
      )}

      {/* Follow-Up Queue */}
      {!boardBriefMode && (
      <section id="follow-up-queue" className="dashboard-operational">
        <DashboardFollowUpQueue filters={filters} />
      </section>
      )}

      {/* Module Snapshots */}
      {!boardBriefMode && (
      <section id="module-snapshots" className="dashboard-operational">
        <ModuleSnapshotCards />
      </section>
      )}

      {/* Recent Activity */}
      {!boardBriefMode && (
      <section id="recent-activity" className="dashboard-operational">
        <RecentActivityFeed filters={filters} />
      </section>
      )}

      {/* Data Health */}
      <section id="data-health" className="scroll-mt-20">
        <DataHealthPanel compact={boardBriefMode} />
      </section>

      {/* Finance & HR Readiness */}
      {!boardBriefMode && (
      <section id="readiness-panels" className="dashboard-operational grid gap-4 lg:grid-cols-2">
        <FinanceReadinessPanel />
        <HrReadinessPanel />
      </section>
      )}

      {/* Quick Navigation */}
      {!boardBriefMode && (
      <div className="dashboard-operational dashboard-no-print">
        <QuickNavCards />
      </div>
      )}

      {/* NGO status chart in board brief mode */}
      {boardBriefMode && (
      <section id="charts" className="scroll-mt-20">
        <NgoPortfolioStatusChart filters={filters} />
      </section>
      )}

      {/* NGO Portfolio Intelligence */}
      {!boardBriefMode && (
      <section id="portfolio-intelligence" className="dashboard-operational">
        <NgoPortfolioIntelligencePanel filters={filters} />
      </section>
      )}

      {/* Grant Pipeline Intelligence */}
      {!boardBriefMode && (
      <section id="grant-pipeline" className="dashboard-operational">
        <GrantPipelineIntelligencePanel />
      </section>
      )}

      {/* Department Workload */}
      <section id="workload">
        <DeptWorkloadChart filters={filters} />
      </section>

      {/* At-Risk & Evidence */}
      {!boardBriefMode && (
      <section id="risk-evidence" className="dashboard-operational">
        <AtRiskAndEvidencePanel filters={filters} />
      </section>
      )}

      {!boardBriefMode && (
      <section id="data-definitions">
        <DashboardDataDefinitions />
      </section>
      )}
    </div>
    </MainLayout>
  );
};

export default Dashboard;
