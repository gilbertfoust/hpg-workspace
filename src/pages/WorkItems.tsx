import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { CreateWorkItemDialog } from "@/components/work-items/CreateWorkItemDialog";
import { WorkItemDrawer } from "@/components/work-items/WorkItemDrawer";
import { WorkItemsTable } from "@/components/work-items/WorkItemsTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "lucide-react";
import { useWorkItems, WorkItemStatus, ModuleType, Priority } from "@/hooks/useWorkItems";
import { useNGOs } from "@/hooks/useNGOs";
import { isSupabaseNotConfiguredError } from "@/integrations/supabase/client";
import { SupabaseNotConfiguredNotice } from "@/components/common/SupabaseNotConfiguredNotice";

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
  const { data: ngos, error: ngosError } = useNGOs();

  if (isSupabaseNotConfiguredError(error) || isSupabaseNotConfiguredError(ngosError)) {
    return (
      <MainLayout title="Work Items" subtitle="Manage and track all assignments across departments">
        <SupabaseNotConfiguredNotice />
      </MainLayout>
    );
  }

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

      <WorkItemsTable
        items={filteredItems}
        isLoading={isLoading}
        error={error}
        ngoMap={ngoMap}
        selectedItems={selectedItems}
        onToggleSelect={toggleSelectItem}
        onToggleSelectAll={toggleSelectAll}
        showSelection
        onRowClick={openWorkItemDrawer}
        emptyMessage="No work items found. Try adjusting your filters or create a new work item."
      />

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
