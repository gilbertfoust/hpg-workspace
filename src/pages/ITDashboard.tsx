import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NewAccessRequestDialog } from "@/components/it/NewAccessRequestDialog";
import { NewTicketDialog } from "@/components/it/NewTicketDialog";
import { AccessRequestsTable } from "@/components/it/AccessRequestsTable";
import { TicketsTable } from "@/components/it/TicketsTable";
import { AccessRequestDrawer } from "@/components/it/AccessRequestDrawer";
import { TicketDrawer } from "@/components/it/TicketDrawer";
import { useITAccessRequests } from "@/hooks/useITAccessRequests";
import { useITTickets } from "@/hooks/useITTickets";
import { useWorkItems, type Priority, type WorkItem } from "@/hooks/useWorkItems";
import type { AccessRequest } from "@/hooks/useITAccessRequests";
import type { Ticket } from "@/hooks/useITTickets";

const quickFilters = [
  { value: "high", label: "High priority" },
  { value: "due_7", label: "Due in 7" },
  { value: "overdue", label: "Overdue" },
  { value: "unassigned", label: "Unassigned" },
] as const;

type QuickFilter = typeof quickFilters[number]["value"] | "all";

const isDueInRange = (dueDate: string | null, days: number) => {
  if (!dueDate) return false;
  const today = new Date();
  const due = new Date(dueDate);
  const rangeEnd = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
  return due >= today && due <= rangeEnd;
};

const isOverdue = (dueDate: string | null) => {
  if (!dueDate) return false;
  const today = new Date();
  return new Date(dueDate) < today;
};

const matchesQuickFilter = (
  filter: QuickFilter,
  workItem?: WorkItem,
  fallbackPriority?: Priority,
) => {
  if (filter === "all") return true;

  switch (filter) {
    case "high":
      return (workItem?.priority || fallbackPriority) === "high";
    case "due_7":
      return isDueInRange(workItem?.due_date || null, 7);
    case "overdue":
      return isOverdue(workItem?.due_date || null);
    case "unassigned":
      return !workItem?.owner_user_id;
    default:
      return true;
  }
};

export default function ITDashboard() {
  const { data: accessRequests, isLoading: accessLoading } = useITAccessRequests();
  const { data: tickets, isLoading: ticketLoading } = useITTickets();
  const { data: workItems } = useWorkItems({ module: "it" });

  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [selectedAccessRequest, setSelectedAccessRequest] = useState<AccessRequest | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const workItemsById = useMemo(
    () => new Map((workItems || []).map((item) => [item.id, item])),
    [workItems],
  );

  const filteredAccessRequests = useMemo(() => {
    return (accessRequests || []).filter((request) => {
      const workItem = request.work_item_id
        ? workItemsById.get(request.work_item_id)
        : undefined;
      return matchesQuickFilter(quickFilter, workItem, request.priority);
    });
  }, [accessRequests, workItemsById, quickFilter]);

  const filteredTickets = useMemo(() => {
    return (tickets || []).filter((ticket) => {
      const workItem = ticket.work_item_id ? workItemsById.get(ticket.work_item_id) : undefined;
      return matchesQuickFilter(quickFilter, workItem, ticket.severity);
    });
  }, [tickets, workItemsById, quickFilter]);

  const selectedAccessWorkItem = selectedAccessRequest?.work_item_id
    ? workItemsById.get(selectedAccessRequest.work_item_id)
    : undefined;
  const selectedTicketWorkItem = selectedTicket?.work_item_id
    ? workItemsById.get(selectedTicket.work_item_id)
    : undefined;

  return (
    <MainLayout
      title="IT"
      subtitle="Track access requests, support tickets, and provisioning evidence."
      actions={
        <div className="flex items-center gap-2">
          <NewAccessRequestDialog />
          <NewTicketDialog />
        </div>
      }
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={quickFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setQuickFilter("all")}
          >
            All
          </Button>
          {quickFilters.map((filter) => (
            <Button
              key={filter.value}
              variant={quickFilter === filter.value ? "default" : "outline"}
              size="sm"
              onClick={() => setQuickFilter(filter.value)}
            >
              {filter.label}
              {quickFilter === filter.value && <Badge className="ml-2" variant="secondary">Active</Badge>}
            </Button>
          ))}
        </div>

        <AccessRequestsTable
          isLoading={accessLoading}
          accessRequests={filteredAccessRequests}
          workItemsById={workItemsById}
          onSelect={(request) => {
            setSelectedAccessRequest(request);
            setSelectedTicket(null);
          }}
        />

        <TicketsTable
          isLoading={ticketLoading}
          tickets={filteredTickets}
          workItemsById={workItemsById}
          onSelect={(ticket) => {
            setSelectedTicket(ticket);
            setSelectedAccessRequest(null);
          }}
        />
      </div>

      <AccessRequestDrawer
        accessRequest={selectedAccessRequest}
        workItem={selectedAccessWorkItem}
        open={!!selectedAccessRequest}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedAccessRequest(null);
          }
        }}
      />

      <TicketDrawer
        ticket={selectedTicket}
        workItem={selectedTicketWorkItem}
        open={!!selectedTicket}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTicket(null);
          }
        }}
      />
    </MainLayout>
  );
}
