import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/common/StatusChip";
import { PriorityBadge } from "@/components/common/PriorityBadge";
import { 
  Plus, 
  Search, 
  ListTodo,
  ExternalLink,
  Calendar,
  Filter
} from "lucide-react";
import { format } from "date-fns";
import { useWorkItems, WorkItemStatus, ModuleType } from "@/hooks/useWorkItems";
import { WorkItemDrawer } from "@/components/work-items/WorkItemDrawer";

interface NGOWorkItemsTabProps {
  ngoId: string;
}

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

const statusOptions: { label: string; value: WorkItemStatus | "all" }[] = [
  { label: "All Statuses", value: "all" },
  { label: "Not Started", value: "not_started" },
  { label: "In Progress", value: "in_progress" },
  { label: "Waiting on NGO", value: "waiting_on_ngo" },
  { label: "Waiting on HPG", value: "waiting_on_hpg" },
  { label: "Under Review", value: "under_review" },
  { label: "Complete", value: "complete" },
];

const moduleOptions: { label: string; value: ModuleType | "all" }[] = [
  { label: "All Modules", value: "all" },
  { label: "NGO Coordination", value: "ngo_coordination" },
  { label: "Administration", value: "administration" },
  { label: "Operations", value: "operations" },
  { label: "Program", value: "program" },
  { label: "Finance", value: "finance" },
  { label: "HR", value: "hr" },
  { label: "Legal", value: "legal" },
];

export function NGOWorkItemsTab({ ngoId }: NGOWorkItemsTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<WorkItemStatus | "all">("all");
  const [moduleFilter, setModuleFilter] = useState<ModuleType | "all">("all");
  const [quickFilter, setQuickFilter] = useState<"monthly-check-ins" | "all">("all");
  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string | null>(null);

  const filters = useMemo(() => ({
    ngo_id: ngoId,
    ...(statusFilter !== "all" && { status: [statusFilter] }),
    ...(moduleFilter !== "all" && { module: moduleFilter }),
    ...(quickFilter === "monthly-check-ins" && { type: "Monthly Check-in" }),
  }), [moduleFilter, ngoId, quickFilter, statusFilter]);

  const { data: workItems, isLoading } = useWorkItems(filters);

  const filteredItems = workItems?.filter(item =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-1 gap-3 w-full sm:w-auto">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search work items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as WorkItemStatus | "all")}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={moduleFilter} onValueChange={(v) => setModuleFilter(v as ModuleType | "all")}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {moduleOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={quickFilter === "monthly-check-ins" ? "default" : "outline"}
            className="whitespace-nowrap"
            onClick={() => setQuickFilter(quickFilter === "monthly-check-ins" ? "all" : "monthly-check-ins")}
          >
            <Filter className="w-4 h-4 mr-2" />
            Monthly Check-ins
          </Button>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Work Item
        </Button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Work Items Table */}
      {!isLoading && filteredItems.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Title</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow 
                    key={item.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedWorkItemId(item.id)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.title}</p>
                        {item.description && (
                          <p className="text-sm text-muted-foreground truncate max-w-md">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm capitalize">
                        {item.module.replace(/_/g, " ")}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusChip status={statusMap[item.status] || "draft"} />
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={item.priority} />
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
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && filteredItems.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <ListTodo className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No work items found</h3>
              <p className="text-muted-foreground mb-4">
                {workItems?.length === 0 
                  ? "Create your first work item for this NGO" 
                  : "Try adjusting your search or filters"}
              </p>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Work Item
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Work Item Drawer */}
      <WorkItemDrawer 
        workItemId={selectedWorkItemId}
        open={!!selectedWorkItemId}
        onOpenChange={(open) => !open && setSelectedWorkItemId(null)}
      />
    </div>
  );
}
