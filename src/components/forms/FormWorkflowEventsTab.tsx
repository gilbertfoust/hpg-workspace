import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Bell, CheckCircle2, Clock, FileWarning, Inbox, XCircle } from "lucide-react";
import { useFormWorkflowEvents } from "@/hooks/useFormWorkflowEvents";
import { isSupabaseNotConfiguredError } from "@/integrations/supabase/client";
import { SupabaseNotConfiguredNotice } from "@/components/common/SupabaseNotConfiguredNotice";

function formatDate(value?: string | null) {
  if (!value) return "Not processed";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "sent") return "default";
  if (status === "queued") return "secondary";
  if (status === "failed") return "destructive";
  return "outline";
}

function statusIcon(status: string) {
  if (status === "sent") return <CheckCircle2 className="h-4 w-4" />;
  if (status === "failed") return <XCircle className="h-4 w-4" />;
  if (status === "skipped") return <FileWarning className="h-4 w-4" />;
  return <Clock className="h-4 w-4" />;
}

export function FormWorkflowEventsTab() {
  const { data: events = [], isLoading, error } = useFormWorkflowEvents();

  if (isSupabaseNotConfiguredError(error)) {
    return <SupabaseNotConfiguredNotice />;
  }

  const queued = events.filter((event) => event.notification_status === "queued").length;
  const sent = events.filter((event) => event.notification_status === "sent").length;
  const skipped = events.filter((event) => event.notification_status === "skipped").length;
  const failed = events.filter((event) => event.notification_status === "failed").length;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <Bell className="h-4 w-4" />
        <AlertTitle>Form workflow events</AlertTitle>
        <AlertDescription>
          This view shows internal workflow events created after forms are submitted. External delivery can be connected after destinations and server-side credentials are configured.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Queued</p>
            <p className="text-2xl font-semibold">{queued}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Sent</p>
            <p className="text-2xl font-semibold">{sent}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Skipped</p>
            <p className="text-2xl font-semibold">{skipped}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Failed</p>
            <p className="text-2xl font-semibold">{failed}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Inbox className="h-4 w-4" /> Recent Events
          </CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No form workflow events have been created yet.
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => {
                const metadata = event.metadata_json || {};
                const formName = typeof metadata.form_name === "string" ? metadata.form_name : "Form submission";
                const departmentName = typeof metadata.department_name === "string" ? metadata.department_name : event.module;

                return (
                  <div key={event.id} className="rounded-lg border p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-muted p-2">{statusIcon(event.notification_status)}</span>
                          <p className="font-medium">{formName}</p>
                          <Badge variant={statusVariant(event.notification_status)}>{event.notification_status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{departmentName} • {event.notification_type}</p>
                        <p className="text-sm">Destination: {event.recipient || "Not configured"}</p>
                        {event.error_message && <p className="text-sm text-destructive">{event.error_message}</p>}
                      </div>
                      <div className="text-xs text-muted-foreground md:text-right">
                        <p>Created: {formatDate(event.created_at)}</p>
                        <p>Processed: {formatDate(event.processed_at)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
