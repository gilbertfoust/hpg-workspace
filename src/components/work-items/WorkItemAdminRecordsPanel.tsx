import { format } from "date-fns";
import { Archive, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkItemAdminRecords } from "@/hooks/useWorkItemAdminRecords";

export const WorkItemAdminRecordsPanel = () => {
  const { data: records, isLoading, isError } = useWorkItemAdminRecords();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Archive className="h-4 w-4 text-primary" />
          Admin Records
        </CardTitle>
        <CardDescription>
          Completed or archived work items sent for filing. Active queues hide these records; they remain available here for audit and reporting.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : isError || !records?.length ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {isError
              ? "Admin records are unavailable until the work_item_admin_records table is connected in Supabase."
              : "No admin records yet. Use Complete & Send to Admin on a work item to file it here."}
          </p>
        ) : (
          <div className="space-y-2">
            {records.slice(0, 12).map((record) => (
              <div key={record.id} className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{record.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {record.module?.replace(/_/g, " ") || "General"} • {record.archive_reason}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge variant="outline" className="text-[10px] capitalize">{record.record_status}</Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(record.completed_at), "MMM d, yyyy")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
