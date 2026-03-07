import { useRevenueStreams } from "@/hooks/useRevenueStreams";
import { useRecurringDonations } from "@/hooks/useRecurringDonations";
import { useRevenueRecognition } from "@/hooks/useRevenueRecognition";
import { KPICard } from "@/components/common/KPICard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { DollarSign, RefreshCw, BarChart3, TrendingUp } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";

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
