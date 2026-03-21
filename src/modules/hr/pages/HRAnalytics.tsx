import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStaffProfiles } from "@/hooks/useStaffProfiles";
import { useTimesheets } from "@/hooks/useTimesheets";
import { usePTORequests } from "@/hooks/usePTORequests";
import { useHRRequisitions } from "@/hooks/useHRRequisitions";
import { Users, Clock, CalendarDays, TrendingDown, Briefcase, DollarSign, BarChart3, UserMinus } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(210, 70%, 55%)", "hsl(150, 60%, 45%)", "hsl(30, 80%, 55%)", "hsl(0, 65%, 55%)"];

export default function HRAnalytics() {
  const { data: staff } = useStaffProfiles();
  const { data: timesheets } = useTimesheets();
  const { data: ptos } = usePTORequests();
  const { data: requisitions } = useHRRequisitions();

  const allStaff = staff || [];
  const activeStaff = allStaff.filter(s => s.status === "active");
  const terminated = allStaff.filter(s => s.status === "terminated");

  // Headcount by employment type
  const byType: Record<string, number> = {};
  activeStaff.forEach(s => { byType[s.employment_type] = (byType[s.employment_type] || 0) + 1; });
  const typeChart = Object.entries(byType).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));

  // Headcount by department
  const byDept: Record<string, number> = {};
  activeStaff.forEach(s => {
    const dept = (s as any).org_units?.department_name || "Unassigned";
    byDept[dept] = (byDept[dept] || 0) + 1;
  });
  const deptChart = Object.entries(byDept).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  // Average tenure
  const tenures = activeStaff.filter(s => s.start_date).map(s => {
    const start = new Date(s.start_date!);
    return (Date.now() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  });
  const avgTenure = tenures.length ? (tenures.reduce((a, b) => a + b, 0) / tenures.length).toFixed(1) : "0";

  // Total payroll cost
  const totalPayroll = activeStaff.reduce((sum, s) => sum + (Number(s.annual_salary) || 0), 0);

  // PTO utilization
  const approvedPTO = ptos?.filter(p => p.status === "approved") || [];
  const totalPTOHours = approvedPTO.reduce((s, p) => s + (p.hours_requested || 0), 0);

  // Open requisitions
  const openReqs = requisitions?.filter(r => r.status === "Open").length ?? 0;

  // Turnover rate (simplified)
  const turnoverRate = allStaff.length ? ((terminated.length / allStaff.length) * 100).toFixed(1) : "0";

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="h-6 w-6" />HR Analytics</h1>
          <p className="text-muted-foreground">Workforce metrics and insights</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Headcount</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{activeStaff.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg Tenure</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{avgTenure} yrs</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Turnover Rate</CardTitle>
              <UserMinus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{turnoverRate}%</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Annual Payroll</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">${(totalPayroll / 1000).toFixed(0)}K</p></CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">PTO Hours Used</CardTitle>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{totalPTOHours}h</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Open Requisitions</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{openReqs}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Approved Timesheets</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{timesheets?.filter(t => t.status === "approved").length ?? 0}</p></CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-sm">Headcount by Department</CardTitle></CardHeader>
            <CardContent>
              {deptChart.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={deptChart} layout="vertical" margin={{ left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={75} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-center py-8 text-muted-foreground">No data</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Employment Type Distribution</CardTitle></CardHeader>
            <CardContent>
              {typeChart.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={typeChart} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {typeChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-center py-8 text-muted-foreground">No data</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
