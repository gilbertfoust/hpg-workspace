import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricBarRow } from "@/components/dashboard/MetricBarRow";
import { useReportsOverview } from "@/hooks/useReportsOverview";
import { isSupabaseNotConfiguredError } from "@/integrations/supabase/client";
import { SupabaseNotConfiguredNotice } from "@/components/common/SupabaseNotConfiguredNotice";

export default function ReportsDashboard() {
  const { data, isLoading, error } = useReportsOverview(12);

  if (isSupabaseNotConfiguredError(error)) {
    return (
      <MainLayout
        title="Executive Reports"
        subtitle="Cross-module insights for leadership"
      >
        <SupabaseNotConfiguredNotice />
      </MainLayout>
    );
  }

  const createdMax = data?.createdPerMonth.reduce(
    (max, item) => Math.max(max, item.count),
    0
  );
  const completedMax = data?.completedPerMonth.reduce(
    (max, item) => Math.max(max, item.count),
    0
  );
  const moduleMax = data?.openByModule.reduce(
    (max, item) => Math.max(max, item.count),
    0
  );

  return (
    <MainLayout
      title="Executive Reports"
      subtitle="Cross-module insights for leadership"
    >
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Work Items Created (Last 12 Months)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : (
              data?.createdPerMonth.map((item) => (
                <MetricBarRow
                  key={item.key}
                  label={item.label}
                  value={item.count}
                  percentage={createdMax ? (item.count / createdMax) * 100 : 0}
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Work Items Completed (Last 12 Months)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : (
              data?.completedPerMonth.map((item) => (
                <MetricBarRow
                  key={item.key}
                  label={item.label}
                  value={item.count}
                  percentage={completedMax ? (item.count / completedMax) * 100 : 0}
                  barClassName="bg-emerald-500"
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle className="text-base font-medium">Open Work Items by Module</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : data?.openByModule.length ? (
              data.openByModule.map((item) => (
                <MetricBarRow
                  key={item.module}
                  label={item.module}
                  value={item.count}
                  percentage={moduleMax ? (item.count / moduleMax) * 100 : 0}
                  barClassName="bg-indigo-500"
                />
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No open work items found.</p>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-medium">NGO Health Snapshot</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : data?.ngoHealth.length ? (
              <div className="data-table">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th>NGO</th>
                      <th>Bundle</th>
                      <th>Country</th>
                      <th>Open</th>
                      <th>Overdue</th>
                      <th>Missing Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ngoHealth.map((ngo) => (
                      <tr key={ngo.id}>
                        <td className="font-medium">{ngo.name}</td>
                        <td className="text-muted-foreground">{ngo.bundle ?? "-"}</td>
                        <td className="text-muted-foreground">{ngo.country ?? "-"}</td>
                        <td>{ngo.openItems}</td>
                        <td className={ngo.overdueItems > 0 ? "text-destructive" : "text-muted-foreground"}>
                          {ngo.overdueItems}
                        </td>
                        <td className={ngo.missingEvidenceItems > 0 ? "text-warning" : "text-muted-foreground"}>
                          {ngo.missingEvidenceItems}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No NGO health data available.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
