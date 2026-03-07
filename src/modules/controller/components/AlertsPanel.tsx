import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useControllerAlerts } from "@/hooks/useControllerAlerts";
import { ALERT_MODULES, ALERT_SEVERITIES, ALERT_STATUSES } from "@/modules/controller/types";
import { useState } from "react";
import { format } from "date-fns";
import { AlertTriangle, Info, AlertOctagon, CheckCircle, XCircle } from "lucide-react";

const severityIcon: Record<string, React.ReactNode> = {
  info: <Info className="h-4 w-4 text-blue-500" />,
  warning: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  critical: <AlertOctagon className="h-4 w-4 text-destructive" />,
};

const severityVariant: Record<string, string> = {
  info: "outline",
  warning: "secondary",
  critical: "destructive",
};

export function AlertsPanel({ ngoId }: { ngoId?: string }) {
  const [moduleFilter, setModuleFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("open");

  const filters: Record<string, string> = {};
  if (ngoId) filters.ngo_id = ngoId;
  if (moduleFilter !== "all") filters.module = moduleFilter;
  if (severityFilter !== "all") filters.severity = severityFilter;
  if (statusFilter !== "all") filters.status = statusFilter;

  const { data: alerts, isLoading, updateStatus } = useControllerAlerts(filters);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Alerts</CardTitle>
          <div className="flex gap-2">
            <Select value={moduleFilter} onValueChange={setModuleFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                {ALERT_MODULES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                {ALERT_SEVERITIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {ALERT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Loading…</p>
        ) : !alerts?.length ? (
          <p className="text-sm text-muted-foreground text-center py-4">No alerts found</p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {alerts.map(alert => (
              <div key={alert.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                {severityIcon[alert.severity]}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={severityVariant[alert.severity] as any}>{alert.severity}</Badge>
                    <Badge variant="outline">{alert.module}</Badge>
                    {(alert as any).ngos && (
                      <span className="text-xs text-muted-foreground">{(alert as any).ngos.common_name || (alert as any).ngos.legal_name}</span>
                    )}
                  </div>
                  <p className="text-sm">{alert.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{format(new Date(alert.created_at), "MMM d, yyyy h:mm a")}</p>
                </div>
                <div className="flex gap-1">
                  {alert.status === "open" && (
                    <>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Resolve" onClick={() => updateStatus.mutate({ id: alert.id, status: "resolved" })}>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Dismiss" onClick={() => updateStatus.mutate({ id: alert.id, status: "dismissed" })}>
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
