import { useState } from "react";
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
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area,
} from "recharts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useNGOStats } from "@/hooks/useNGOs";
import { useWorkItems } from "@/hooks/useWorkItems";
import { useWorkItems as useWorkItemsAll } from "@/hooks/useWorkItems";
import { Loader2 } from "lucide-react";
import { format, subMonths, startOfMonth } from "date-fns";

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

function useWorkItemTrend() {
  const { data: workItems } = useWorkItems({});
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
      if (!["complete", "approved"].includes(wi.status)) return false;
      const d = new Date(wi.updated_at);
      return d >= start && d < nextMonth;
    }).length ?? 0;
    months.push({ month: label, created, completed });
  }
  return months;
}

function useStatusDistribution() {
  const { data: workItems } = useWorkItems({});
  const statusMap = new Map<string, number>();
  workItems?.forEach(wi => {
    const s = wi.status.replace(/_/g, " ");
    statusMap.set(s, (statusMap.get(s) ?? 0) + 1);
  });
  return Array.from(statusMap.entries()).map(([name, value]) => ({ name, value }));
}

const DashboardKPIs = () => {
  const { data: dashboardData, isLoading: dashboardLoading } = useDashboardData({});
  const { data: ngoStats, isLoading: ngoStatsLoading } = useNGOStats();
  const { data: allWorkItems } = useWorkItemsAll({});

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

  const activeNgoCount = ngoStats?.active || 0;
  const overdueCount = dashboardData?.kpis?.overdue || 0;
  const dueIn7Days = dashboardData?.kpis?.dueIn7Days || 0;
  const totalWorkItems = allWorkItems?.length ?? 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Active NGOs</CardTitle>
          <Building2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{activeNgoCount}</p>
          <p className="text-xs text-muted-foreground">Sponsored organizations</p>
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
          <p className="text-xs text-muted-foreground">All time across modules</p>
        </CardContent>
      </Card>
    </div>
  );
};

const WorkItemTrendChart = () => {
  const trendData = useWorkItemTrend();
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

const StatusDistributionChart = () => {
  const statusData = useStatusDistribution();
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

const DeptWorkloadChart = () => {
  const { data: dashboardData } = useDashboardData({});
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

const AtRiskAndEvidencePanel = () => {
  const { data: dashboardData } = useDashboardData({});
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

  return (
    <MainLayout>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
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
            HPG Workspace
          </h1>
          <p className="text-muted-foreground">
            Overview of NGOs, work items, finances, and compliance across Humanity Pathways Global.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate("/ngos")}>
            <Users className="w-4 h-4 mr-2" />
            View NGOs
          </Button>
          <Button onClick={() => navigate("/work-items")}>
            Open Work Queue
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>

      {/* KPI Row */}
      <DashboardKPIs />

      {/* Quick Navigation */}
      <QuickNavCards />

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        <WorkItemTrendChart />
        <StatusDistributionChart />
      </div>

      {/* Department Workload */}
      <DeptWorkloadChart />

      {/* At-Risk & Evidence */}
      <AtRiskAndEvidencePanel />
    </div>
    </MainLayout>
};

export default Dashboard;
