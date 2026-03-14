import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, FileWarning, Calendar } from "lucide-react";
import { format } from "date-fns";
import { useWorkItems, WorkItemStatus } from "@/hooks/useWorkItems";
import { useNGOs } from "@/hooks/useNGOs";
import { useOrgUnits } from "@/hooks/useOrgUnits";
import { StatusChip } from "@/components/common/StatusChip";
import { WorkItemDrawer } from "@/components/work-items/WorkItemDrawer";

const statusMap: Record<string, "approved" | "in-progress" | "rejected" | "draft" | "waiting-ngo" | "waiting-hpg" | "under-review" | "submitted"> = {
  draft: "draft",
  not_started: "draft",
  in_progress: "in-progress",
  waiting_on_ngo: "waiting-ngo",
  waiting_on_hpg: "waiting-hpg",
  submitted: "submitted",
  under_review: "under-review",
  approved: "approved",
  rejected: "rejected",
  complete: "approved",
  canceled: "draft",
};

export default function NGOMissingItems() {
  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string | null>(null);
  const { data: ngos, isLoading: ngosLoading } = useNGOs();
  const { data: orgUnits, isLoading: orgUnitsLoading } = useOrgUnits();

  const activeStatuses: WorkItemStatus[] = ["not_started", "in_progress", "waiting_on_ngo", "waiting_on_hpg", "submitted", "under_review"];
  const { data: workItems, isLoading: workItemsLoading } = useWorkItems({
    evidence_required: true,
    status: activeStatuses,
  });

  const ngoLookup = useMemo(() => {
    return new Map((ngos || []).map((ngo) => [ngo.id, ngo]));
  }, [ngos]);

  const departmentLookup = useMemo(() => {
    return new Map((orgUnits || []).map((unit) => [unit.id, unit.department_name]));
  }, [orgUnits]);

  const missingItems = useMemo(() => {
    const today = new Date();
    return (workItems || [])
      .filter((item) => item.evidence_status !== "approved")
      .map((item) => {
        const dueDate = item.due_date ? new Date(item.due_date) : null;
        const isOverdue = dueDate ? dueDate < today : false;
        return {
          ...item,
          ngo: item.ngo_id ? ngoLookup.get(item.ngo_id) : null,
          departmentName: item.department_id ? departmentLookup.get(item.department_id) : null,
          isOverdue,
        };
      })
      .sort((a, b) => {
        if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
        if (!a.due_date || !b.due_date) return 0;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });
  }, [departmentLookup, ngoLookup, workItems]);

  const isLoading = ngosLoading || orgUnitsLoading || workItemsLoading;

  return (
    <MainLayout title="NGO Missing Items">
      <div className="space-y-6">
        <Card>
          <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6">
            <div>
              <h2 className="text-lg font-semibold">Missing evidence & overdue requests</h2>
              <p className="text-sm text-muted-foreground">
                Track NGOs with outstanding evidence requirements or overdue document requests.
              </p>
            </div>
            <Badge variant="outline" className="text-sm w-fit">
              {missingItems.length} items
            </Badge>
          </CardContent>
        </Card>

        {isLoading && (
          <Card>
            <CardContent className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((row) => (
                <Skeleton key={row} className="h-10" />
              ))}
            </CardContent>
          </Card>
        )}

        {!isLoading && missingItems.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>NGO</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Evidence</TableHead>
                    <TableHead>Due Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {missingItems.map((item) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedWorkItemId(item.id)}
                    >
                      <TableCell className="font-medium">
                        {item.ngo?.common_name || item.ngo?.legal_name || "Unassigned"}
                      </TableCell>
                      <TableCell className="max-w-[260px]">
                        <div className="flex items-center gap-2">
                          {item.isOverdue && <AlertTriangle className="w-4 h-4 text-destructive" />}
                          <span className="truncate">{item.title}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.departmentName || "—"}
                      </TableCell>
                      <TableCell>
                        {item.status && <StatusChip status={statusMap[item.status] || "draft"} />}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.evidence_status === "approved" ? "secondary" : "outline"} className="capitalize">
                          {item.evidence_status?.replace(/_/g, " ") || "missing"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.due_date ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                            {format(new Date(item.due_date), "MMM d, yyyy")}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {!isLoading && missingItems.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <FileWarning className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No missing items</h3>
              <p className="text-sm text-muted-foreground">
                All evidence requirements and document requests are up to date.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <WorkItemDrawer
        workItemId={selectedWorkItemId}
        open={!!selectedWorkItemId}
        onOpenChange={(open) => !open && setSelectedWorkItemId(null)}
      />
    </MainLayout>
  );
}
