import { MainLayout } from "@/components/layout/MainLayout";
import { KPICard } from "@/components/common/KPICard";
import { StatusChip } from "@/components/common/StatusChip";
import { PriorityBadge } from "@/components/common/PriorityBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Clock,
  AlertTriangle,
  FileCheck,
  Building2,
  Users,
  TrendingUp,
  ArrowRight,
  Calendar,
  ClipboardList,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useWorkItems, useWorkItemStats } from "@/hooks/useWorkItems";
import { useNGOStats, useNGOs } from "@/hooks/useNGOs";
import { format } from "date-fns";

const statusMap: Record<string, "approved" | "in-progress" | "rejected" | "draft" | "waiting-ngo" | "under-review"> = {
  not_started: "draft",
  in_progress: "in-progress",
  waiting_on_ngo: "waiting-ngo",
  waiting_on_hpg: "waiting-ngo",
  submitted: "in-progress",
  under_review: "under-review",
  approved: "approved",
  rejected: "rejected",
  complete: "approved",
  canceled: "rejected",
  draft: "draft",
};

const priorityMap: Record<string, "low" | "medium" | "high"> = {
  low: "low",
  medium: "medium",
  high: "high",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: workItemStats, isLoading: statsLoading } = useWorkItemStats();
  const { data: ngoStats, isLoading: ngoStatsLoading } = useNGOStats();
  const { data: workItems, isLoading: workItemsLoading } = useWorkItems();
  const { data: ngos } = useNGOs();

  // Get work items due soon (next 7 days)
  const today = new Date();
  const in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const dueSoonItems = workItems?.filter(item => {
    if (!item.due_date) return false;
    const dueDate = new Date(item.due_date);
    return dueDate >= today && dueDate <= in7Days && !['complete', 'canceled'].includes(item.status);
  }).slice(0, 5) || [];

  // Get at-risk NGOs
  const atRiskNGOs = ngos?.filter(ngo => ngo.status === 'at_risk') || [];

  // Get overdue items
  const overdueItems = workItems?.filter(item => {
    if (!item.due_date) return false;
    const dueDate = new Date(item.due_date);
    return dueDate < today && !['complete', 'canceled'].includes(item.status);
  }) || [];

  return (
    <MainLayout
      title="Executive Dashboard"
      subtitle="Overview of HPG operations and pending actions"
      actions={
        <Button onClick={() => navigate('/work-items')}>
          <ClipboardList className="w-4 h-4 mr-2" />
          My Queue
        </Button>
      }
    >
      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statsLoading ? (
          <>
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </>
        ) : (
          <>
            <KPICard
              title="Due in 7 Days"
              value={workItemStats?.dueIn7Days || 0}
              subtitle={`${workItemStats?.dueIn30Days || 0} in 30 days`}
              icon={<Clock className="w-5 h-5" />}
              variant="warning"
            />
            <KPICard
              title="Overdue Items"
              value={workItemStats?.overdue || 0}
              subtitle="Needs immediate attention"
              icon={<AlertTriangle className="w-5 h-5" />}
              variant="danger"
            />
            <KPICard
              title="Pending Evidence"
              value={workItemStats?.pendingEvidence || 0}
              subtitle="Items awaiting documents"
              icon={<FileCheck className="w-5 h-5" />}
            />
            <KPICard
              title="Active NGOs"
              value={ngoStats?.active || 0}
              subtitle={`${ngoStats?.total || 0} total`}
              icon={<Building2 className="w-5 h-5" />}
              variant="success"
            />
          </>
        )}
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {ngoStatsLoading ? (
          <>
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </>
        ) : (
          <>
            <KPICard
              title="At-Risk NGOs"
              value={ngoStats?.at_risk || 0}
              icon={<AlertTriangle className="w-5 h-5" />}
              variant="danger"
            />
            <KPICard
              title="Onboarding"
              value={ngoStats?.onboarding || 0}
              subtitle="NGOs in progress"
              icon={<Building2 className="w-5 h-5" />}
              variant="warning"
            />
            <KPICard
              title="Completed This Week"
              value={workItemStats?.complete || 0}
              icon={<TrendingUp className="w-5 h-5" />}
            />
          </>
        )}
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="due-soon" className="space-y-4">
        <TabsList>
          <TabsTrigger value="due-soon">Due Soon</TabsTrigger>
          <TabsTrigger value="overdue">Overdue ({overdueItems.length})</TabsTrigger>
          <TabsTrigger value="at-risk">At-Risk NGOs ({atRiskNGOs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="due-soon">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium">Work Items Due Soon</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate('/work-items')}>
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {workItemsLoading ? (
                <div className="p-6 space-y-3">
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                </div>
              ) : dueSoonItems.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  No work items due in the next 7 days
                </div>
              ) : (
                <div className="data-table">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Module</th>
                        <th>Status</th>
                        <th>Priority</th>
                        <th>Due Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dueSoonItems.map((item) => (
                        <tr key={item.id} className="cursor-pointer" onClick={() => navigate('/work-items')}>
                          <td className="font-medium">{item.title}</td>
                          <td className="text-muted-foreground capitalize">{item.module.replace('_', ' ')}</td>
                          <td><StatusChip status={statusMap[item.status] || "draft"} /></td>
                          <td><PriorityBadge priority={priorityMap[item.priority] || "medium"} /></td>
                          <td className="text-muted-foreground">
                            {item.due_date ? format(new Date(item.due_date), 'MMM d, yyyy') : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overdue">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Overdue Items</CardTitle>
            </CardHeader>
            <CardContent>
              {overdueItems.length === 0 ? (
                <p className="text-muted-foreground text-sm">No overdue items! 🎉</p>
              ) : (
                <div className="data-table">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Module</th>
                        <th>Status</th>
                        <th>Due Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overdueItems.slice(0, 5).map((item) => (
                        <tr key={item.id} className="cursor-pointer" onClick={() => navigate('/work-items')}>
                          <td className="font-medium">{item.title}</td>
                          <td className="text-muted-foreground capitalize">{item.module.replace('_', ' ')}</td>
                          <td><StatusChip status={statusMap[item.status] || "draft"} /></td>
                          <td className="text-destructive">
                            {item.due_date ? format(new Date(item.due_date), 'MMM d, yyyy') : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="at-risk">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">At-Risk NGOs</CardTitle>
            </CardHeader>
            <CardContent>
              {atRiskNGOs.length === 0 ? (
                <p className="text-muted-foreground text-sm">No at-risk NGOs currently.</p>
              ) : (
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
                      {atRiskNGOs.map((ngo) => (
                        <tr key={ngo.id}>
                          <td className="font-medium">{ngo.common_name || ngo.legal_name}</td>
                          <td className="text-muted-foreground">{ngo.bundle || '-'}</td>
                          <td className="text-muted-foreground">{ngo.city || ngo.country || '-'}</td>
                          <td>
                            <Button variant="outline" size="sm" onClick={() => navigate(`/ngos`)}>
                              View
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Access Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        <Card className="module-card cursor-pointer" onClick={() => navigate('/ngos')}>
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
                <span className="text-muted-foreground">{ngoStats?.active || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Onboarding</span>
                <span className="text-muted-foreground">{ngoStats?.onboarding || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Prospects</span>
                <span className="text-muted-foreground">{ngoStats?.prospect || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="module-card cursor-pointer" onClick={() => navigate('/work-items')}>
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
                <span>Active</span>
                <span className="text-muted-foreground">{workItemStats?.active || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Due in 7 days</span>
                <span className="text-muted-foreground">{workItemStats?.dueIn7Days || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Overdue</span>
                <span className="text-destructive">{workItemStats?.overdue || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="module-card cursor-pointer" onClick={() => navigate('/forms')}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <FileCheck className="w-5 h-5 text-success" />
              </div>
              <div>
                <h3 className="font-medium">Forms</h3>
                <p className="text-sm text-muted-foreground">Submit and track</p>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">
                Launch forms for NGO intake, expense requests, document requests, and more.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
