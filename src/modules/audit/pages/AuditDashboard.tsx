import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, History, KeyRound, ArrowRight, FileSearch, Database, MessageSquare, Trello, BookOpen } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useSystemUsageAudits } from "@/hooks/useSystemUsageAudits";

const providerDetails = {
  google_drive: { label: "Google Drive", icon: Database },
  confluence: { label: "Confluence", icon: BookOpen },
  slack: { label: "Slack", icon: MessageSquare },
  trello: { label: "Trello", icon: Trello },
};

export default function AuditDashboard() {
  const navigate = useNavigate();
  const { data: recentLogs, isLoading } = useAuditLog({});
  const { data: usageReports = [], isLoading: usageLoading } = useSystemUsageAudits();
  
  const recent = (recentLogs ?? []).slice(0, 10);
  const totalToday = (recentLogs ?? []).filter(
    (l) => new Date(l.created_at).toDateString() === new Date().toDateString()
  ).length;
  const creates = (recentLogs ?? []).filter((l) => l.action_type === "create").length;
  const updates = (recentLogs ?? []).filter((l) => l.action_type === "update").length;
  const deletes = (recentLogs ?? []).filter((l) => l.action_type === "delete").length;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6" />
            Audit & Compliance
          </h1>
          <p className="text-muted-foreground">System-wide audit trail, action logs, and permission tracking</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Events</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{recentLogs?.length ?? 0}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Today</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{totalToday}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Creates / Updates</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{creates} / {updates}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Deletes</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold text-destructive">{deletes}</p></CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/audit/trail")}>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <History className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Audit Trail</h3>
                <p className="text-sm text-muted-foreground">Full log of all data changes</p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/audit/permissions")}>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <KeyRound className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Permission Changes</h3>
                <p className="text-sm text-muted-foreground">Track role and access modifications</p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly connected-system usage analysis</CardTitle>
            <p className="text-sm text-muted-foreground">
              IT-owned evidence cycle for Google Drive, Confluence, Slack, and Trello usage, security exceptions, adoption, and recommendations.
            </p>
          </CardHeader>
          <CardContent>
            {usageLoading ? (
              <p className="text-sm text-muted-foreground">Loading monthly audit coverage…</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {(Object.keys(providerDetails) as Array<keyof typeof providerDetails>).map((provider) => {
                  const report = usageReports.find((item) => item.provider === provider);
                  const details = providerDetails[provider];
                  const Icon = details.icon;
                  return (
                    <div key={provider} className="rounded-lg border p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2"><Icon className="h-4 w-4" /><p className="font-medium">{details.label}</p></div>
                        <Badge variant={report?.status === "reviewed" ? "default" : report?.status === "exception" ? "destructive" : "outline"}>
                          {report?.status || "missing"}
                        </Badge>
                      </div>
                      <div className="mt-3 text-xs text-muted-foreground">
                        <p>{report?.findings?.length || 0} findings</p>
                        <p>{report?.recommendations?.length || 0} recommendations</p>
                      </div>
                      {report?.source_url && <a href={report.source_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-xs text-primary hover:underline">Open source report</a>}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileSearch className="h-4 w-4" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-center py-4">Loading…</p>
            ) : !recent.length ? (
              <p className="text-muted-foreground text-center py-4">No audit events yet</p>
            ) : (
              <div className="space-y-3">
                {recent.map((log) => (
                  <div key={log.id} className="flex items-center gap-3 text-sm">
                    <span className="text-xs text-muted-foreground w-32 shrink-0">
                      {format(new Date(log.created_at), "MMM d HH:mm")}
                    </span>
                    <Badge variant="outline" className="text-xs">{log.action_type}</Badge>
                    <span className="text-muted-foreground">{log.entity_type.replace(/_/g, " ")}</span>
                    {log.reason && <span className="truncate text-muted-foreground">— {log.reason}</span>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
