import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { KPICard } from "@/components/common/KPICard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricBarRow } from "@/components/dashboard/MetricBarRow";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  AlertTriangle,
  ClipboardList,
  Building2,
  ArrowRight,
  ClipboardList,
  Clock,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { format } from "date-fns";
import { ModuleType } from "@/hooks/useWorkItems";
import { useDashboardData, useDashboardFilters } from "@/hooks/useDashboardData";
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
  const [selectedBundle, setSelectedBundle] = useState("all");
  const [selectedCountry, setSelectedCountry] = useState("all");
  const [selectedState, setSelectedState] = useState("all");
  const [selectedModule, setSelectedModule] = useState("all");

  const filters = useMemo(
    () => ({
      bundle: selectedBundle !== "all" ? selectedBundle : undefined,
      country: selectedCountry !== "all" ? selectedCountry : undefined,
      state: selectedState !== "all" ? selectedState : undefined,
      module: selectedModule !== "all" ? (selectedModule as ModuleType) : undefined,
    }),
    [selectedBundle, selectedCountry, selectedState, selectedModule],
  );

  const {
    data: filterOptions,
    isLoading: filterLoading,
    error: filterError,
  } = useDashboardFilters();
  const { data: dashboardData, isLoading: dataLoading, error: dashboardError } = useDashboardData(filters);

  const supabaseNotConfigured =
    isSupabaseNotConfiguredError(filterError) || isSupabaseNotConfiguredError(dashboardError);
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

  const moduleOptions = filterOptions?.modules ?? [];
  const formatModuleLabel = (module: string) =>
    module
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  const workloadMax = dashboardData?.workloadByDepartment.reduce(
    (max, item) => Math.max(max, item.openCount),
    0
  );

  return (
    <MainLayout
      title="Executive Dashboard"
      subtitle="Overview of HPG operations and pending actions"
      actions={
        <Button onClick={() => navigate('/my-queue')}>
        <Button onClick={() => navigate("/work-items")}>
          <ClipboardList className="w-4 h-4 mr-2" />
          My Queue
        </Button>
      }
    >
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Dashboard Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Bundle</label>
                <Select
                  value={selectedBundle}
                  onValueChange={setSelectedBundle}
                  disabled={filterLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Bundles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Bundles</SelectItem>
                    {filterOptions?.bundles.map((bundle) => (
                      <SelectItem key={bundle} value={bundle}>
                        {bundle}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Country</label>
                <Select
                  value={selectedCountry}
                  onValueChange={setSelectedCountry}
                  disabled={filterLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Countries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Countries</SelectItem>
                    {filterOptions?.countries.map((country) => (
                      <SelectItem key={country} value={country}>
                        {country}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">State/Province</label>
                <Select
                  value={selectedState}
                  onValueChange={setSelectedState}
                  disabled={filterLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All States" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All States</SelectItem>
                    {filterOptions?.states.map((state) => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Module</label>
                <Select
                  value={selectedModule}
                  onValueChange={setSelectedModule}
                  disabled={filterLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Modules" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Modules</SelectItem>
                    {moduleOptions.map((module) => (
                      <SelectItem key={module} value={module}>
                        {formatModuleLabel(module)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {dataLoading ? (
            <>
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </>
          ) : (
            <>
              <KPICard
                title="Due in 7 Days"
                value={dashboardData?.kpis.dueIn7Days || 0}
                subtitle="Next 7 days"
                icon={<Clock className="w-5 h-5" />}
                variant="warning"
              />
              <KPICard
                title="Due in 30 Days"
                value={dashboardData?.kpis.dueIn30Days || 0}
                subtitle="Next 30 days"
                icon={<Clock className="w-5 h-5" />}
              />
              <KPICard
                title="Due in 90 Days"
                value={dashboardData?.kpis.dueIn90Days || 0}
                subtitle="Next 90 days"
                icon={<Clock className="w-5 h-5" />}
              />
              <KPICard
                title="Overdue Items"
                value={dashboardData?.kpis.overdue || 0}
                subtitle="Needs immediate attention"
                icon={<AlertTriangle className="w-5 h-5" />}
                variant="danger"
              />
              <KPICard
                title="At-Risk NGOs"
                value={dashboardData?.kpis.atRiskNgos || 0}
                subtitle="Requires escalation"
                icon={<Building2 className="w-5 h-5" />}
                variant="warning"
              />
              <KPICard
                title="Pending Reviews"
                value={dashboardData?.kpis.pendingDocuments || 0}
                subtitle="Documents awaiting review"
                icon={<FileCheck className="w-5 h-5" />}
              />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">Workload by Department</CardTitle>
            </CardHeader>
            <CardContent>
              {dataLoading ? (
                <Skeleton className="h-64" />
              ) : dashboardData?.workloadByDepartment.length ? (
                <ChartContainer
                  config={{ count: { label: "Active Work Items", color: "hsl(var(--chart-1))" } }}
                  className="h-64 w-full aspect-auto"
                >
                  <BarChart data={dashboardData.workloadByDepartment}>
                    <XAxis
                      dataKey="department"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) =>
                        value.length > 10 ? `${value.slice(0, 10)}…` : value
                      }
                    />
                    <YAxis allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No active work items for the selected filters.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium">Evidence Pending Review</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate("/work-items")}>
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {dataLoading ? (
                <div className="p-6 space-y-3">
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                </div>
              ) : dashboardData?.evidencePending.length ? (
                <div className="data-table">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th>NGO</th>
                        <th>Department</th>
                        <th>Owner</th>
                        <th>Due Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData.evidencePending.slice(0, 8).map((item) => (
                        <tr key={item.id}>
                          <td className="font-medium">{item.ngoName}</td>
                          <td className="text-muted-foreground">{item.department}</td>
                          <td className="text-muted-foreground">{item.owner}</td>
                          <td className="text-muted-foreground">
                            {item.dueDate ? format(new Date(item.dueDate), "MMM d, yyyy") : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-6 text-center text-muted-foreground">
                  No evidence awaiting review for the selected filters.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
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
                View All <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {dataLoading ? (
              <div className="p-6 space-y-3">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : dashboardData?.atRiskNgos.length ? (
              <div className="data-table">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th>NGO</th>
                      <th>Bundle</th>
                      <th>Location</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData.atRiskNgos.map((ngo) => (
                      <tr key={ngo.id}>
                        <td className="font-medium">{ngo.name}</td>
                        <td className="text-muted-foreground">{ngo.bundle || "-"}</td>
                        <td className="text-muted-foreground">{ngo.location}</td>
                        <td>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/ngos/${ngo.id}`)}
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-center text-muted-foreground">
                No at-risk NGOs for the selected filters.
              </div>
            )}
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <Card className="module-card cursor-pointer" onClick={() => navigate('/ngos')}>
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

        <Card className="module-card cursor-pointer" onClick={() => navigate('/my-queue')}>
        <Card className="module-card cursor-pointer" onClick={() => navigate("/work-items")}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-warning" />
              </div>
              <div>
                <h3 className="font-medium">My Queue</h3>
                <p className="text-sm text-muted-foreground">Your assignments</p>
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

        <Card className="module-card cursor-pointer" onClick={() => navigate('/dept-queue')}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-info" />
              </div>
              <div>
                <h3 className="font-medium">Dept Queue</h3>
                <p className="text-sm text-muted-foreground">Team priorities</p>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">
                Review department work items and manage upcoming deadlines.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="module-card cursor-pointer" onClick={() => navigate('/forms')}>
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
