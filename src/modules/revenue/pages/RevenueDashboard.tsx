import { useRevenueStreams } from "@/hooks/useRevenueStreams";
import { useRecurringDonations } from "@/hooks/useRecurringDonations";
import { useRevenueRecognition } from "@/hooks/useRevenueRecognition";
import { KPICard } from "@/components/common/KPICard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { DollarSign, RefreshCw, BarChart3, TrendingUp } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(210, 70%, 55%)",
  "hsl(150, 60%, 45%)",
  "hsl(40, 80%, 55%)",
  "hsl(340, 65%, 50%)",
  "hsl(270, 50%, 55%)",
];

export default function RevenueDashboard() {
  const navigate = useNavigate();
  const { data: streams } = useRevenueStreams();
  const { data: donations } = useRecurringDonations();
  const { data: recognition } = useRevenueRecognition();

  const activeStreams = streams?.filter(s => s.is_active) ?? [];
  const totalTarget = activeStreams.reduce((s, r) => s + (r.annual_target ?? 0), 0);
  const activeDonations = donations?.filter(d => d.status === "active") ?? [];
  const monthlyRecurring = activeDonations.reduce((s, d) => {
    const amt = d.amount;
    if (d.frequency === "monthly") return s + amt;
    if (d.frequency === "quarterly") return s + amt / 3;
    if (d.frequency === "annual") return s + amt / 12;
    if (d.frequency === "weekly") return s + amt * 4.33;
    return s + amt;
  }, 0);
  const totalRecognized = recognition?.reduce((s, r) => s + r.amount, 0) ?? 0;

  // Chart data: streams by type
  const streamsByType = new Map<string, number>();
  activeStreams.forEach(s => {
    const type = s.stream_type?.replace(/_/g, " ") ?? "Other";
    streamsByType.set(type, (streamsByType.get(type) ?? 0) + (s.annual_target ?? 0));
  });
  const pieData = Array.from(streamsByType.entries()).map(([name, value]) => ({ name, value }));

  // Recognition by type
  const recByType = new Map<string, number>();
  recognition?.forEach(r => {
    const type = r.recognition_type?.replace(/_/g, " ") ?? "Other";
    recByType.set(type, (recByType.get(type) ?? 0) + r.amount);
  });
  const recBarData = Array.from(recByType.entries()).map(([name, amount]) => ({ name, amount }));

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Revenue Management</h1>
          <p className="text-muted-foreground">Donation types, recurring revenue, and recognition schedules</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KPICard title="Revenue Streams" value={activeStreams.length} icon={<BarChart3 className="h-4 w-4" />} />
          <KPICard title="Annual Target" value={`$${totalTarget.toLocaleString()}`} icon={<TrendingUp className="h-4 w-4" />} />
          <KPICard title="Monthly Recurring" value={`$${Math.round(monthlyRecurring).toLocaleString()}`} icon={<RefreshCw className="h-4 w-4" />} />
          <KPICard title="Total Recognized" value={`$${totalRecognized.toLocaleString()}`} icon={<DollarSign className="h-4 w-4" />} />
        </div>

        {/* Charts */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Revenue by Stream Type</CardTitle>
              <CardDescription>Annual target by category</CardDescription>
            </CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={false}>
                        {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">No stream data</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recognition by Type</CardTitle>
              <CardDescription>Amount recognized per recognition method</CardDescription>
            </CardHeader>
            <CardContent>
              {recBarData.length > 0 ? (
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={recBarData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                      <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Recognized" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">No recognition data</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Navigation Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/revenue/donations")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Revenue Streams</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{streams?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Donation types & sources</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/revenue/recurring")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Recurring Donations</CardTitle>
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{activeDonations.length}</p>
              <p className="text-xs text-muted-foreground">Active recurring donors</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/revenue/recognition")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Revenue Recognition</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{recognition?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Recognition entries</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
