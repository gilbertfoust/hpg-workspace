import { MainLayout } from "@/components/layout/MainLayout";
import { KPICard } from "@/components/common/KPICard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricBarRow } from "@/components/dashboard/MetricBarRow";
import {
  AlertTriangle,
  ClipboardList,
  Building2,
  ListChecks,
  ArrowRight,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useReportsDashboard } from "@/hooks/useReportsDashboard";
import { isSupabaseNotConfiguredError } from "@/integrations/supabase/client";
import { SupabaseNotConfiguredNotice } from "@/components/common/SupabaseNotConfiguredNotice";

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    data: dashboardData,
    isLoading,
    error,
  } = useReportsDashboard();

  const supabaseNotConfigured = isSupabaseNotConfiguredError(error);

  if (supabaseNotConfigured) {
    return (
      <MainLayout
        title="Executive Dashboard"
        subtitle="Overview of HPG operations and pending actions"
      >
        <SupabaseNotConfiguredNotice />
      </MainLayout>
    );
  }

  const workloadMax = dashboardData?.workloadByDepartment.reduce(
    (max, item) => Math.max(max, item.openCount),
    0
  );

  return (
    <MainLayout
      title="Executive Dashboard"
      subtitle="Overview of HPG operations and pending actions"
      actions={
        <Button onClick={() => navigate("/work-items")}>
          <ClipboardList className="w-4 h-4 mr-2" />
          My Queue
        </Button>
      }
    >
      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {isLoading ? (
          <>
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </>
        ) : (
          <>
            <KPICard
              title="Total Active NGOs"
              value={dashboardData?.kpis.activeNgos ?? 0}
              subtitle="Currently operational"
              icon={<Building2 className="w-5 h-5" />}
              variant="success"
            />
            <KPICard
              title="NGOs Marked At-Risk"
              value={dashboardData?.kpis.atRiskNgos ?? 0}
              subtitle="Immediate attention needed"
              icon={<AlertTriangle className="w-5 h-5" />}
              variant="danger"
            />
            <KPICard
              title="Open Work Items"
              value={dashboardData?.kpis.openWorkItems ?? 0}
              subtitle="Across all modules"
              icon={<ListChecks className="w-5 h-5" />}
              variant="warning"
            />
            <KPICard
              title="Overdue Work Items"
              value={dashboardData?.kpis.overdueWorkItems ?? 0}
              subtitle="Past due date"
              icon={<ClipboardList className="w-5 h-5" />}
              variant="danger"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">Workload by Department</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/work-items")}>
                View Work Items <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : dashboardData?.workloadByDepartment.length ? (
              <div className="space-y-4">
                {dashboardData.workloadByDepartment.map((item) => (
                  <MetricBarRow
                    key={item.department}
                    label={item.department}
                    value={item.openCount}
                    percentage={workloadMax ? (item.openCount / workloadMax) * 100 : 0}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No open work items by department.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">At-Risk NGOs</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/ngos")}> 
                Review NGOs <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : dashboardData?.atRiskNgos.length ? (
              <div className="space-y-3">
                {dashboardData.atRiskNgos.map((ngo) => (
                  <div
                    key={ngo.id}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
                    <div>
                      <p className="font-medium text-sm">{ngo.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Bundle: {ngo.bundle ?? "Unassigned"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {ngo.coordinatorName ?? "Coordinator TBD"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ngo.coordinatorEmail ?? "No coordinator assigned"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No NGOs currently marked at-risk.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Access Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        <Card className="module-card cursor-pointer" onClick={() => navigate("/ngos")}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-info" />
              </div>
              <div>
                <h3 className="font-medium">NGO Overview</h3>
                <p className="text-sm text-muted-foreground">View all organizations</p>
              </div>
            </div>
            <div className="space-y-2 mt-4">
              <div className="flex justify-between text-sm">
                <span>Active</span>
                <span className="text-muted-foreground">{dashboardData?.kpis.activeNgos ?? 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>At-Risk</span>
                <span className="text-destructive">{dashboardData?.kpis.atRiskNgos ?? 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="module-card cursor-pointer" onClick={() => navigate("/work-items")}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-warning" />
              </div>
              <div>
                <h3 className="font-medium">Work Items</h3>
                <p className="text-sm text-muted-foreground">Task management</p>
              </div>
            </div>
            <div className="space-y-2 mt-4">
              <div className="flex justify-between text-sm">
                <span>Open</span>
                <span className="text-muted-foreground">{dashboardData?.kpis.openWorkItems ?? 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Overdue</span>
                <span className="text-destructive">{dashboardData?.kpis.overdueWorkItems ?? 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="module-card cursor-pointer" onClick={() => navigate("/reports")}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-success" />
              </div>
              <div>
                <h3 className="font-medium">Executive Reports</h3>
                <p className="text-sm text-muted-foreground">Cross-module performance</p>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">
                View time-based trends, module distribution, and NGO health snapshots.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
