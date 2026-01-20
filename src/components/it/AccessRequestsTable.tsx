import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/common/StatusChip";
import { PriorityBadge } from "@/components/common/PriorityBadge";
import type { AccessRequest } from "@/hooks/useITAccessRequests";
import type { WorkItem } from "@/hooks/useWorkItems";
import { statusChipMap } from "@/components/it/itUtils";
import { format } from "date-fns";

interface AccessRequestsTableProps {
  isLoading: boolean;
  accessRequests: AccessRequest[];
  workItemsById: Map<string, WorkItem>;
  onSelect: (accessRequest: AccessRequest) => void;
}

export function AccessRequestsTable({
  isLoading,
  accessRequests,
  workItemsById,
  onSelect,
}: AccessRequestsTableProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Access Requests</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-10 w-full" />
            ))}
          </div>
        ) : accessRequests.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No access requests yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request</TableHead>
                <TableHead>Target User</TableHead>
                <TableHead>Requested By</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>SLA</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accessRequests.map((request) => {
                const workItem = request.work_item_id
                  ? workItemsById.get(request.work_item_id)
                  : undefined;
                return (
                  <TableRow
                    key={request.id}
                    className="cursor-pointer"
                    onClick={() => onSelect(request)}
                  >
                    <TableCell className="font-medium">{request.request_type}</TableCell>
                    <TableCell>{request.target_user}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {request.requested_by_user_id}
                    </TableCell>
                    <TableCell>
                      <StatusChip status={statusChipMap[request.status]} />
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={workItem?.priority || request.priority} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(request.updated_at || request.created_at), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
