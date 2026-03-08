import { MainLayout } from "@/components/layout/MainLayout";
import { UsageSummaryCards } from "@/components/usage-accounting/UsageSummaryCards";
import { UsageEntriesTable } from "@/components/usage-accounting/UsageEntriesTable";
import { RestrictionCheckPanel } from "@/components/usage-accounting/RestrictionCheckPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

const UsageReportsPage = () => (
  <MainLayout>
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Usage Reports</h1>
        <p className="text-muted-foreground">Analyze usage patterns, allocation trends, and cost distribution.</p>
      </div>
      <UsageSummaryCards />
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Usage by Cost Center</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Charts and detailed breakdowns will render here once usage data is populated. Filter by period, cost center type, and source to drill into allocation efficiency.</p>
            </CardContent>
          </Card>
        </div>
        <div>
          <RestrictionCheckPanel />
        </div>
      </div>
      <UsageEntriesTable filters={{ status: "allocated" }} />
    </div>
  </MainLayout>
);

export default UsageReportsPage;
