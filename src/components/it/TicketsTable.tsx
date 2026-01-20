import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/common/StatusChip";
import { PriorityBadge } from "@/components/common/PriorityBadge";
import type { Ticket } from "@/hooks/useITTickets";
import type { WorkItem } from "@/hooks/useWorkItems";
import { statusChipMap } from "@/components/it/itUtils";
import { format } from "date-fns";

interface TicketsTableProps {
  isLoading: boolean;
  tickets: Ticket[];
  workItemsById: Map<string, WorkItem>;
  onSelect: (ticket: Ticket) => void;
}

export function TicketsTable({ isLoading, tickets, workItemsById, onSelect }: TicketsTableProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Support Tickets</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-10 w-full" />
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No tickets logged.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Reporter</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket) => {
                const workItem = ticket.work_item_id
                  ? workItemsById.get(ticket.work_item_id)
                  : undefined;
                return (
                  <TableRow
                    key={ticket.id}
                    className="cursor-pointer"
                    onClick={() => onSelect(ticket)}
                  >
                    <TableCell className="font-medium">{ticket.subject}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {ticket.reporter_user_id}
                    </TableCell>
                    <TableCell>
                      <StatusChip status={statusChipMap[ticket.status]} />
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={workItem?.priority || ticket.severity} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {ticket.assigned_to_user_id || "Unassigned"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(ticket.updated_at || ticket.created_at), "MMM d, yyyy")}
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
