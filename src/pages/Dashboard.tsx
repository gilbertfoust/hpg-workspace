import { MainLayout } from "@/components/layout/MainLayout";
import { KPICard } from "@/components/common/KPICard";
import { StatusChip } from "@/components/common/StatusChip";
import { PriorityBadge } from "@/components/common/PriorityBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

// Mock data for demonstration
const mockWorkItems = [
  {
    id: "1",
    title: "Submit Q4 Financial Report",
    ngo: "Detroit Community Foundation",
    status: "waiting-ngo" as const,
    priority: "high" as const,
    dueDate: "2026-01-15",
    department: "Finance",
  },
  {
    id: "2",
    title: "Complete Onboarding Checklist",
    ngo: "Chicago Youth Initiative",
    status: "in-progress" as const,
    priority: "medium" as const,
    dueDate: "2026-01-18",
    department: "NGO Coordination",
  },
  {
    id: "3",
    title: "Review Grant Application",
    ngo: "Mexican Education Alliance",
    status: "under-review" as const,
    priority: "high" as const,
    dueDate: "2026-01-14",
    department: "Development",
  },
  {
    id: "4",
    title: "IT Access Setup",
    ngo: "African Youth Network",
    status: "not-started" as const,
    priority: "low" as const,
    dueDate: "2026-01-20",
    department: "IT",
  },
];

const mockAtRiskNGOs = [
  { name: "Lagos Youth Center", reason: "Missing compliance docs", daysOverdue: 12 },
  { name: "Manila Skills Hub", reason: "No contact in 30 days", daysOverdue: 8 },
];

export default function Dashboard() {
  return (
    <MainLayout
      title="Executive Dashboard"
      subtitle="Overview of HPG operations and pending actions"
      actions={
        <Button>
          <ClipboardList className="w-4 h-4 mr-2" />
          My Queue
        </Button>
      }
    >
      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard
          title="Due in 7 Days"
          value={8}
          subtitle="3 high priority"
          icon={<Clock className="w-5 h-5" />}
          variant="warning"
        />
        <KPICard
          title="Overdue Items"
          value={3}
          subtitle="Needs immediate attention"
          icon={<AlertTriangle className="w-5 h-5" />}
          variant="danger"
        />
        <KPICard
          title="Pending Approvals"
          value={12}
          subtitle="Across 4 departments"
          icon={<FileCheck className="w-5 h-5" />}
        />
        <KPICard
          title="Active NGOs"
          value={47}
          subtitle="+3 this month"
          icon={<Building2 className="w-5 h-5" />}
          trend="up"
          trendValue="+6.8%"
          variant="success"
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KPICard
          title="At-Risk NGOs"
          value={2}
          icon={<AlertTriangle className="w-5 h-5" />}
          variant="danger"
        />
        <KPICard
          title="Missing Evidence"
          value={7}
          subtitle="Items awaiting documents"
          icon={<FileCheck className="w-5 h-5" />}
          variant="warning"
        />
        <KPICard
          title="Completed This Week"
          value={23}
          icon={<TrendingUp className="w-5 h-5" />}
          trend="up"
          trendValue="+15%"
        />
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="due-soon" className="space-y-4">
        <TabsList>
          <TabsTrigger value="due-soon">Due Soon</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
          <TabsTrigger value="at-risk">At-Risk NGOs</TabsTrigger>
          <TabsTrigger value="pending-approval">Pending Approval</TabsTrigger>
        </TabsList>

        <TabsContent value="due-soon">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium">Work Items Due Soon</CardTitle>
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="data-table">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>NGO</th>
                      <th>Department</th>
                      <th>Status</th>
                      <th>Priority</th>
                      <th>Due Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockWorkItems.map((item) => (
                      <tr key={item.id} className="cursor-pointer">
                        <td className="font-medium">{item.title}</td>
                        <td className="text-muted-foreground">{item.ngo}</td>
                        <td className="text-muted-foreground">{item.department}</td>
                        <td><StatusChip status={item.status} /></td>
                        <td><PriorityBadge priority={item.priority} /></td>
                        <td className="text-muted-foreground">{item.dueDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overdue">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Overdue Items</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">3 work items are past their due date.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="at-risk">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">At-Risk NGOs</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="data-table">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th>NGO</th>
                      <th>Reason</th>
                      <th>Days Overdue</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockAtRiskNGOs.map((ngo, idx) => (
                      <tr key={idx}>
                        <td className="font-medium">{ngo.name}</td>
                        <td className="text-muted-foreground">{ngo.reason}</td>
                        <td>
                          <span className="status-chip status-rejected">{ngo.daysOverdue} days</span>
                        </td>
                        <td>
                          <Button variant="outline" size="sm">View</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending-approval">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Pending Your Approval</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">12 items are waiting for your review and approval.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Access Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        <Card className="module-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-info" />
              </div>
              <div>
                <h3 className="font-medium">Workload by Department</h3>
                <p className="text-sm text-muted-foreground">View distribution</p>
              </div>
            </div>
            <div className="space-y-2 mt-4">
              <div className="flex justify-between text-sm">
                <span>Finance</span>
                <span className="text-muted-foreground">8 items</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Legal</span>
                <span className="text-muted-foreground">5 items</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Development</span>
                <span className="text-muted-foreground">12 items</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="module-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-warning" />
              </div>
              <div>
                <h3 className="font-medium">Upcoming Deadlines</h3>
                <p className="text-sm text-muted-foreground">Next 30 days</p>
              </div>
            </div>
            <div className="space-y-2 mt-4">
              <div className="flex justify-between text-sm">
                <span>Jan 15</span>
                <span className="text-muted-foreground">Q4 Reports</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Jan 20</span>
                <span className="text-muted-foreground">Grant Deadline</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Jan 31</span>
                <span className="text-muted-foreground">Annual Filing</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="module-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-success" />
              </div>
              <div>
                <h3 className="font-medium">This Week's Progress</h3>
                <p className="text-sm text-muted-foreground">Completion rate</p>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-end gap-2">
                <span className="text-3xl font-semibold">78%</span>
                <span className="text-sm text-success mb-1">+12% vs last week</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full mt-3">
                <div className="h-full bg-success rounded-full" style={{ width: "78%" }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
