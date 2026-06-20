import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Building2, DollarSign, FileText, GraduationCap, Loader2, ShieldCheck, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardModuleSnapshots, type DashboardModuleSnapshot } from "@/hooks/useDashboardModuleSnapshots";

const icons: Record<string, ReactNode> = {
  "ngo-coordination": <Building2 className="h-4 w-4" />,
  "development-grants": <TrendingUp className="h-4 w-4" />,
  finance: <DollarSign className="h-4 w-4" />,
  hr: <GraduationCap className="h-4 w-4" />,
  "documents-forms": <FileText className="h-4 w-4" />,
  compliance: <ShieldCheck className="h-4 w-4" />,
};

const statusVariant = (status: DashboardModuleSnapshot["status"]): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "connected") return "default";
  if (status === "attention") return "destructive";
  if (status === "building") return "secondary";
  return "outline";
};

const statusLabel = (status: DashboardModuleSnapshot["status"]) => {
  if (status === "connected") return "Connected";
  if (status === "attention") return "Needs Attention";
  if (status === "building") return "In Build";
  return "Needs Build";
};

const metricToneClass = (tone?: DashboardModuleSnapshot["metrics"][number]["tone"]) => {
  if (tone === "danger") return "text-destructive";
  if (tone === "warning") return "text-orange-500";
  if (tone === "success") return "text-green-600";
  return "text-foreground";
};

export const ModuleSnapshotCards = () => {
  const navigate = useNavigate();
  const { data: snapshots, isLoading } = useDashboardModuleSnapshots();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Module Snapshots</CardTitle>
        <CardDescription>Live health and readiness view for major HPG workspace areas. System-wide snapshot.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(snapshots ?? []).map((snapshot) => (
              <Card key={snapshot.id} className="border-muted">
                <CardHeader className="space-y-3 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-primary/10 p-2 text-primary">{icons[snapshot.id]}</span>
                      <div>
                        <CardTitle className="text-sm">{snapshot.title}</CardTitle>
                        <CardDescription className="text-xs">{snapshot.description}</CardDescription>
                      </div>
                    </div>
                    <Badge variant={statusVariant(snapshot.status)}>{statusLabel(snapshot.status)}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    {snapshot.metrics.map((metric) => (
                      <div key={metric.label} className="rounded-md border p-2">
                        <p className="text-[11px] text-muted-foreground">{metric.label}</p>
                        <p className={`mt-1 text-sm font-semibold ${metricToneClass(metric.tone)}`}>{metric.value}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">{snapshot.note}</p>
                  <Button variant="outline" size="sm" className="w-full" onClick={() => navigate(snapshot.path)}>
                    Open {snapshot.title}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
