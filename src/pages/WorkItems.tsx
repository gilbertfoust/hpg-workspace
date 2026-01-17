import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PriorityBadge } from "@/components/common/PriorityBadge";
import { InlineStatusSelect } from "@/components/work-items/InlineStatusSelect";
import { CreateWorkItemDialog } from "@/components/work-items/CreateWorkItemDialog";
import { WorkItemDrawer } from "@/components/work-items/WorkItemDrawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Link2,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useWorkItems, WorkItemStatus, ModuleType, Priority } from "@/hooks/useWorkItems";
import { useNGOs } from "@/hooks/useNGOs";

const modules: { value: string; label: string }[] = [
  { value: "all", label: "All Modules" },
  { value: "ngo_coordination", label: "NGO Coordination" },
  { value: "administration", label: "Administration" },
  { value: "operations", label: "Operations" },
  { value: "program", label: "Program" },
  { value: "curriculum", label: "Curriculum" },
  { value: "development", label: "Development" },
  { value: "partnership", label: "Partnership" },
  { value: "marketing", label: "Marketing" },
  { value: "communications", label: "Communications" },
  { value: "hr", label: "HR" },
  { value: "it", label: "IT" },
  { value: "finance", label: "Finance" },
  { value: "legal", label: "Legal" },
];

const statusOptions: { value: string; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting_on_ngo", label: "Waiting on NGO" },
  { value: "waiting_on_hpg", label: "Waiting on HPG" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under Review" },
  { value: "approved", label: "Approved" },
  { value: "complete", label: "Complete" },
];

const priorityOptions: { value: string; label: string }[] = [
  { value: "all", label: "All Priorities" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export default function WorkItems() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModule, setSelectedModule] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedPriority, setSelectedPriority] = useState("all");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Build filters for the query
  const filters = useMemo(() => {
    const f: {
      module?: ModuleType;
      status?: WorkItemStatus[];
    } = {};

    if (selectedModule !== "all") {
      f.module = selectedModule as ModuleType;
    }
    if (selectedStatus !== "all") {
      f.status = [selectedStatus as WorkItemStatus];
    }

    return f;
  }, [selectedModule, selectedStatus]);

  const { data: workItems, isLoading, error } = useWorkItems(filters);
  const { data: ngos } = useNGOs();

  // Create NGO lookup map
  const ngoMap = useMemo(() => {
    const map = new Map<string, string>();
    ngos?.forEach((ngo) => {
      map.set(ngo.id, ngo.common_name || ngo.legal_name);
    });
    return map;
  }, [ngos]);

  // Client-side filtering for search and priority
  const filteredItems = useMemo(() => {
    if (!workItems) return [];

    return workItems.filter((item) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesDescription = item.description?.toLowerCase().includes(query);
        const matchesNgo = item.ngo_id && ngoMap.get(item.ngo_id)?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDescription && !matchesNgo) {
          return false;
        }
      }

      // Priority filter
      if (selectedPriority !== "all" && item.priority !== selectedPriority) {
        return false;
      }

      return true;
    });
  }, [workItems, searchQuery, selectedPriority, ngoMap]);

  const toggleSelectItem = (id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === filteredItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredItems.map((item) => item.id));
    }
  };

  const openWorkItemDrawer = (id: string) => {
    setSelectedWorkItemId(id);
    setDrawerOpen(true);
  };

  const formatModuleName = (module: string) => {
    return module.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <MainLayout
      title="Work Items"
      subtitle="Manage and track all assignments across departments"
      actions={
        <div className="flex items-center gap-2">
          {selectedItems.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  Bulk Actions ({selectedItems.length})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Reassign Owner</DropdownMenuItem>
                <DropdownMenuItem>Change Due Date</DropdownMenuItem>
                <DropdownMenuItem>Update Status</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Sync to Trello</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Work Item
          </Button>
        </div>
      }
    >
      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search work items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Select value={selectedModule} onValueChange={setSelectedModule}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {modules.map((module) => (
                <SelectItem key={module.value} value={module.value}>
                  {module.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedPriority} onValueChange={setSelectedPriority}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {priorityOptions.map((priority) => (
                <SelectItem key={priority.value} value={priority.value}>
                  {priority.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              setSelectedModule("all");
              setSelectedStatus("all");
              setSelectedPriority("all");
              setSearchQuery("");
            }}
          >
            <Filter className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Work Items Table */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="data-table overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="w-10">
                  <Checkbox
                    checked={filteredItems.length > 0 && selectedItems.length === filteredItems.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
                <th>Title</th>
                <th>NGO</th>
                <th>Module</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Due Date</th>
                <th>Evidence</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td><Skeleton className="h-4 w-4" /></td>
                    <td><Skeleton className="h-4 w-48" /></td>
                    <td><Skeleton className="h-4 w-32" /></td>
                    <td><Skeleton className="h-4 w-24" /></td>
                    <td><Skeleton className="h-6 w-24" /></td>
                    <td><Skeleton className="h-5 w-16" /></td>
                    <td><Skeleton className="h-4 w-24" /></td>
                    <td><Skeleton className="h-5 w-16" /></td>
                    <td><Skeleton className="h-8 w-8" /></td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-muted-foreground">
                    Error loading work items: {error.message}
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-muted-foreground">
                    No work items found. Try adjusting your filters or create a new work item.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className="group cursor-pointer"
                    onClick={() => openWorkItemDrawer(item.id)}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedItems.includes(item.id)}
                        onCheckedChange={() => toggleSelectItem(item.id)}
                      />
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.title}</span>
                        {item.dependencies && item.dependencies.length > 0 && (
                          <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                        {item.approval_required && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-info" />
                        )}
                      </div>
                    </td>
                    <td className="text-muted-foreground">
                      {item.ngo_id ? ngoMap.get(item.ngo_id) || "Unknown" : "—"}
                    </td>
                    <td>
                      <Badge variant="secondary" className="text-xs font-normal capitalize">
                        {formatModuleName(item.module)}
                      </Badge>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <InlineStatusSelect
                        workItemId={item.id}
                        currentStatus={item.status}
                      />
                    </td>
                    <td>
                      <PriorityBadge priority={item.priority} />
                    </td>
                    <td className="text-muted-foreground whitespace-nowrap">
                      {item.due_date ? (
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {format(new Date(item.due_date), "MMM d, yyyy")}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {item.evidence_required ? (
                        <span
                          className={`status-chip ${
                            item.evidence_status === "missing"
                              ? "evidence-missing"
                              : item.evidence_status === "uploaded"
                              ? "evidence-uploaded"
                              : item.evidence_status === "approved"
                              ? "evidence-approved"
                              : "evidence-under-review"
                          }`}
                        >
                          {item.evidence_status === "missing" && (
                            <AlertCircle className="w-3 h-3 mr-1" />
                          )}
                          {item.evidence_status || "Required"}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openWorkItemDrawer(item.id)}>
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>Edit</DropdownMenuItem>
                          <DropdownMenuItem>Reassign</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>Sync to Trello</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination placeholder */}
      <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
        <span>
          Showing {filteredItems.length} of {workItems?.length || 0} items
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled>
            Next
          </Button>
        </div>
      </div>

      {/* Create Dialog */}
      <CreateWorkItemDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      {/* Work Item Detail Drawer */}
      <WorkItemDrawer
        workItemId={selectedWorkItemId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </MainLayout>
  );
}