import { Activity, AlertTriangle, CheckCircle2, Database, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardDataHealth, type DataHealthStatus } from "@/hooks/useDashboardDataHealth";
import { DashboardPanelState } from "@/components/dashboard/DashboardPanelState";

const statusVariant = (status: DataHealthStatus): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "connected") return "default";
  if (status === "empty") return "secondary";
  return "destructive";
};

const statusIcon = (status: DataHealthStatus) => {
  if (status === "connected") return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (status === "empty") return <AlertTriangle className="h-4 w-4 text-orange-500" />;
  return <AlertTriangle className="h-4 w-4 text-destructive" />;
};

const statusLabel = (status: DataHealthStatus) => {
  if (status === "connected") return "Live";
  if (status === "empty") return "Empty";
  return "Missing";
};

export const DataHealthPanel = ({ compact = false }: { compact?: boolean }) => {
  const { data, isLoading, isError, refetch } = useDashboardDataHealth();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          System / Data Health
        </CardTitle>
        <CardDescription>
          {compact
            ? "Summary of dashboard data source readiness."
            : "Shows which dashboard data sources are live, empty, or still need schema/build work."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <DashboardPanelState
            isError
            errorMessage="System and data health checks could not load."
            onRetry={() => void refetch()}
          />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Readiness</p>
                <p className="mt-1 text-2xl font-semibold">{data?.readiness ?? 0}%</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Live Sources</p>
                <p className="mt-1 text-2xl font-semibold text-green-600">{data?.connected ?? 0}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Empty Sources</p>
                <p className="mt-1 text-2xl font-semibold text-orange-500">{data?.empty ?? 0}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Missing Sources</p>
                <p className="mt-1 text-2xl font-semibold text-destructive">{data?.missing ?? 0}</p>
              </div>
            </div>

            {!compact && (
              <>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {(data?.items ?? []).map((item) => (
                <div key={item.table} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.area}</p>
                    </div>
                    {statusIcon(item.status)}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <Badge variant={statusVariant(item.status)}>{statusLabel(item.status)}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {item.count === null ? "—" : `${item.count} records`}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{item.message}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              <Activity className="h-4 w-4" />
              <span>
                Live means the table is connected and has records. Empty means the table exists but has no records yet. Missing means the dashboard could not access the source.
              </span>
            </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
