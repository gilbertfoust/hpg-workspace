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
} from "lucide-react";
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
import { useWorkItems } from "@/hooks/useWorkItems";
import { useWorkItems as useWorkItemsAll } from "@/hooks/useWorkItems";
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
import { SavedDashboardViews } from "@/components/dashboard/SavedDashboardViews";
import { useSavedDashboardViews, type SavedDashboardView } from "@/hooks/useSavedDashboardViews";
import { useDashboardSectionScroll, useDashboardUrlState, type DashboardSectionId } from "@/hooks/useDashboardUrlState";

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

const hasActiveFilters = (filters: DashboardFilters) =>
  Boolean(filters.bundle || filters.country || filters.state || filters.module);

const toSearchParams = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value));
  });
  const value = search.toString();
  return value ? `?${value}` : "";
};

function useWorkItemTrend(filters: DashboardFilters) {
  const { data: workItems } = useWorkItems(filters.module ? { module: filters.module } : {});
  const months: { month: string; created: number; completed: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const start = startOfMonth(subMonths(now, i));
    const label = format(start, "MMM");
    const nextMonth = startOfMonth(subMonths(now, i - 1));
    const created = workItems?.filter(wi => {
      const d = new Date(wi.created_at);
      return d >= start && d < nextMonth;
    }).length ?? 0;
    const completed = workItems?.filter(wi => {
      if (!["complete", "approved", "Complete", "Approved"].includes(wi.status)) return false;
      const d = new Date(wi.updated_at);
      return d >= start && d < nextMonth;
    }).length ?? 0;
    months.push({ month: label, created, completed });
  }
  return months;
}

function useStatusDistribution(filters: DashboardFilters) {
  const { data: workItems } = useWorkItems(filters.module ? { module: filters.module } : {});
  const statusMap = new Map<string, number>();
  workItems?.forEach(wi => {
    const s = wi.status.replace(/_/g, " ");
    statusMap.set(s, (statusMap.get(s) ?? 0) + 1);
  });
  return Array.from(statusMap.entries()).map(([name, value]) => ({ name, value }));
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
  const { data: options, isLoading } = useDashboardFilters();

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
        ) : (
          <div className="grid gap-3 md:grid-cols-4">
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
    { label: "Overdue Work Items", path: `/work-items${toSearchParams({ ...baseParams, due: "overdue" })}`, icon: AlertCircle },
    { label: "Due This Week", path: `/work-items${toSearchParams({ ...baseParams, due: "7d" })}`, icon: Clock },
    { label: "High Priority", path: `/work-items${toSearchParams({ ...baseParams, priority: "high" })}`, icon: TrendingUp },
    { label: "Waiting on NGO", path: `/work-items${toSearchParams({ ...baseParams, status: "waiting_on_ngo" })}`, icon: Users },
    { label: "Out of Compliance NGOs", path: `/ngos${toSearchParams({ ...baseParams, portfolioStatus: "out_of_compliance" })}`, icon: Shield },
    { label: "Grant Applications", path: `/grants${toSearchParams({ ...baseParams, view: "applications" })}`, icon: Briefcase },
    { label: "Pending Documents", path: `/documents${toSearchParams({ ...baseParams, review_status: "Pending" })}`, icon: FileText },
    { label: "Data Health", path: `/dashboard${toSearchParams({ ...baseParams, section: "data-health" })}`, icon: LayoutDashboard },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Dashboard Drilldowns</CardTitle>
        <CardDescription>Jump from the dashboard into focused queues and filtered workspace views.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
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
  const { data: dashboardData, isLoading: dashboardLoading } = useDashboardData(filters);
  const { data: ngoStats, isLoading: ngoStatsLoading } = useNGOStats();
  const { data: allWorkItems } = useWorkItemsAll(filters.module ? { module: filters.module } : {});

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

  const totalNgoCount = hasActiveFilters(filters) ? dashboardData?.kpis?.totalNgos || 0 : dashboardData?.kpis?.totalNgos || ngoStats?.total || 0;
  const overdueCount = dashboardData?.kpis?.overdue || 0;
  const dueIn7Days = dashboardData?.kpis?.dueIn7Days || 0;
  const totalWorkItems = allWorkItems?.length ?? 0;

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
  const trendData = useWorkItemTrend(filters);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Work Item Trend</CardTitle>
        <CardDescription>Created vs completed — last 6 months</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
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
        </div>
      </CardContent>
    </Card>
  );
};

const StatusDistributionChart = ({ filters }: { filters: DashboardFilters }) => {
  const statusData = useStatusDistribution(filters);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Status Distribution</CardTitle>
        <CardDescription>Active work items by status</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={false}>
                {statusData.map((_, index) => (
                  <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

const NgoPortfolioStatusChart = ({ filters }: { filters: DashboardFilters }) => {
  const { data: dashboardData } = useDashboardData(filters);
  const portfolioData = dashboardData?.ngoStatusDistribution?.filter((item) => item.value > 0) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">NGO Portfolio Status</CardTitle>
        <CardDescription>Where everyone stands in the HPG relationship pipeline</CardDescription>
      </CardHeader>
      <CardContent>
        {portfolioData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No NGO portfolio data available</p>
        ) : (
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={portfolioData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={false}>
                  {portfolioData.map((_, index) => (
                    <Cell key={index} fill={CHART_COLORS[(index + 2) % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const DeptWorkloadChart = ({ filters }: { filters: DashboardFilters }) => {
  const { data: dashboardData } = useDashboardData(filters);
  const workload = dashboardData?.workloadByDepartment ?? [];
  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="text-base">Workload by Department</CardTitle>
        <CardDescription>Open work items per department</CardDescription>
      </CardHeader>
      <CardContent>
        {workload.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No department workload data available</p>
        ) : (
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workload} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis dataKey="department" type="category" width={120} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Open Items" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const AtRiskAndEvidencePanel = ({ filters }: { filters: DashboardFilters }) => {
  const { data: dashboardData } = useDashboardData(filters);
  const navigate = useNavigate();
  const missingEvidenceCount = dashboardData?.evidencePending?.length || 0;

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
                <div key={ngo.id} className="flex items-center justify-between p-2 border rounded text-sm cursor-pointer hover:bg-accent/50" onClick={() => navigate(`/ngo/${ngo.id}`)}>
                  <div>
                    <p className="font-medium">{ngo.name}</p>
                    <p className="text-xs text-muted-foreground">{ngo.location}</p>
                  </div>
                  {ngo.bundle && <Badge variant="outline" className="text-xs">{ngo.bundle}</Badge>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">No at-risk NGOs</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-orange-500" />
            Missing Evidence ({missingEvidenceCount})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dashboardData?.evidencePending && dashboardData.evidencePending.length > 0 ? (
            <div className="space-y-2">
              {dashboardData.evidencePending.slice(0, 8).map((item) => (
                <div key={item.id} className="flex items-center justify-between p-2 border rounded text-sm">
                  <div>
                    <p className="font-medium">{item.ngoName}</p>
                    <p className="text-xs text-muted-foreground">{item.department}</p>
                  </div>
                  {item.dueDate && (
                    <Badge variant="outline" className="text-xs">
                      {new Date(item.dueDate).toLocaleDateString()}
                    </Badge>
                  )}
                </div>
              ))}
              {missingEvidenceCount > 8 && (
                <p className="text-xs text-muted-foreground text-center">+{missingEvidenceCount - 8} more</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">All evidence up to date</p>
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
  const [logoFailed, setLogoFailed] = useState(false);
  const [boardBriefMode, setBoardBriefMode] = useState(false);
  const { filters, section, setFilters, applyView, resetToDefault } = useDashboardUrlState();
  const { toFilters } = useSavedDashboardViews();
  useDashboardSectionScroll(section);

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

  return (
    <MainLayout>
    <div className="space-y-6 dashboard-page">
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
      <section id="filters">
        <DashboardFilterControls
          filters={filters}
          setFilters={setFilters}
          section={section}
          onApplySavedView={handleApplySavedView}
          onResetView={resetToDefault}
        />
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
      <section id="data-health">
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

      {/* Charts Row */}
      <section id="charts" className={`grid gap-4 md:grid-cols-2 ${boardBriefMode ? "md:grid-cols-1" : ""}`}>
        {!boardBriefMode && <WorkItemTrendChart filters={filters} />}
        {!boardBriefMode && <StatusDistributionChart filters={filters} />}
        <NgoPortfolioStatusChart filters={filters} />
      </section>

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
    </div>
    </MainLayout>
  );
};

export default Dashboard;
