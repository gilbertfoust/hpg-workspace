import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { CreateWorkItemDialog } from "@/components/work-items/CreateWorkItemDialog";
import { WorkItemAdminRecordsPanel } from "@/components/work-items/WorkItemAdminRecordsPanel";
import { WorkItemsTable } from "@/components/work-items/WorkItemsTable";
import { WorkItemDrawer } from "@/components/work-items/WorkItemDrawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, Filter } from "lucide-react";
import { useCompleteWorkItemForAdminRecords, useSyncWorkItemsToTrello, useWorkItems, WorkItem, WorkItemStatus, ModuleType } from "@/hooks/useWorkItems";
import { useNGOs } from "@/hooks/useNGOs";
import { useOrgUnits } from "@/hooks/useOrgUnits";
import { useAuth } from "@/contexts/AuthContext";
import { Switch } from "@/components/ui/switch";
import { isSupabaseNotConfiguredError } from "@/integrations/supabase/client";
import { SupabaseNotConfiguredNotice } from "@/components/common/SupabaseNotConfiguredNotice";
import { useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

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
  { value: "rejected", label: "Rejected" },
  { value: "complete", label: "Complete" },
  { value: "canceled", label: "Canceled" },
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
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [myItemsOnly, setMyItemsOnly] = useState(false);
  const [completingItemId, setCompletingItemId] = useState<string | null>(null);
  const [syncingTrelloItemId, setSyncingTrelloItemId] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const workItemIdFromSearch = searchParams.get("workItemId");
  const completeForRecords = useCompleteWorkItemForAdminRecords();
  const syncToTrello = useSyncWorkItemsToTrello();

  const filters = useMemo(() => {
    const f: { module?: ModuleType; status?: WorkItemStatus[]; owner_user_id?: string; department_id?: string } = {};
    if (selectedModule !== "all") f.module = selectedModule as ModuleType;
    if (selectedStatus !== "all") f.status = [selectedStatus as WorkItemStatus];
    if (myItemsOnly && user?.id) f.owner_user_id = user.id;
    if (selectedDepartment !== "all") f.department_id = selectedDepartment;
    return f;
  }, [selectedModule, selectedStatus, selectedDepartment, myItemsOnly, user?.id]);

  const { data: workItems, isLoading, error } = useWorkItems(filters);
  const { data: ngos, error: ngosError } = useNGOs();
  const { data: orgUnits } = useOrgUnits();

  const ngoMap = useMemo(() => {
    const map = new Map<string, string>();
    ngos?.forEach((ngo) => map.set(ngo.id, ngo.common_name || ngo.legal_name));
    return map;
  }, [ngos]);

  const filteredItems = useMemo(() => {
    if (!workItems) return [];
    return workItems.filter((item) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesDescription = item.description?.toLowerCase().includes(query);
        const matchesNgo = item.ngo_id && ngoMap.get(item.ngo_id)?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDescription && !matchesNgo) return false;
      }
      if (selectedPriority !== "all" && item.priority !== selectedPriority) return false;
      return true;
    });
  }, [workItems, searchQuery, selectedPriority, ngoMap]);

  useEffect(() => {
    if (workItemIdFromSearch) {
      setSelectedWorkItemId(workItemIdFromSearch);
      setDrawerOpen(true);
    }
  }, [workItemIdFromSearch]);

  if (isSupabaseNotConfiguredError(error) || isSupabaseNotConfiguredError(ngosError)) {
    return <MainLayout title="Work Items"><SupabaseNotConfiguredNotice /></MainLayout>;
  }

  const toggleSelectItem = (id: string) => setSelectedItems((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  const toggleSelectAll = () => setSelectedItems(selectedItems.length === filteredItems.length ? [] : filteredItems.map((item) => item.id));
  const openWorkItemDrawer = (id: string) => { setSelectedWorkItemId(id); setDrawerOpen(true); };

  const handleCompleteForRecords = async (id: string) => {
    setCompletingItemId(id);
    try {
      await completeForRecords.mutateAsync({ id, notes: "Checked off complete and sent to admin records" });
      setSelectedItems((prev) => prev.filter((itemId) => itemId !== id));
      toast({ title: "Work item completed", description: "It was sent to Admin Records and removed from the active list." });
    } catch (err) {
      toast({ variant: "destructive", title: "Unable to complete work item", description: err instanceof Error ? err.message : "The work item could not be completed." });
    } finally {
      setCompletingItemId(null);
    }
  };

  const handleDrawerOpenChange = (open: boolean) => {
    setDrawerOpen(open);
    if (!open) {
      setSelectedWorkItemId(null);
      if (workItemIdFromSearch) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete("workItemId");
        setSearchParams(nextParams);
      }
    }
  };

  const handleSyncToTrello = async (items: WorkItem[]) => {
    if (items.length === 0) return;
    if (items.length === 1) setSyncingTrelloItemId(items[0].id);
    try {
      await syncToTrello.mutateAsync(items);
      toast({
        title: "Trello synchronization queued",
        description: `${items.length} work item${items.length === 1 ? "" : "s"} will sync through the configured department route.`,
      });
      setSelectedItems([]);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Unable to queue Trello sync",
        description: err instanceof Error ? err.message : "Trello sync could not be queued.",
      });
    } finally {
      setSyncingTrelloItemId(null);
    }
  };

  return (
    <MainLayout title="Work Items" subtitle="Manage and track all active assignments across departments" actions={<div className="flex items-center gap-2">{selectedItems.length > 0 && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline">Bulk Actions ({selectedItems.length})</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => handleSyncToTrello(filteredItems.filter((item) => selectedItems.includes(item.id)))}>Sync to Trello</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}<Button onClick={() => setCreateDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />Create Work Item</Button></div>}>
      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Search work items..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" /></div>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2 rounded-lg border px-3 py-2 bg-background"><Switch checked={myItemsOnly} onCheckedChange={setMyItemsOnly} id="my-items-toggle" /><label htmlFor="my-items-toggle" className="text-sm text-muted-foreground">My items</label></div>
          <Select value={selectedModule} onValueChange={setSelectedModule}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent>{modules.map((module) => <SelectItem key={module.value} value={module.value}>{module.label}</SelectItem>)}</SelectContent></Select>
          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}><SelectTrigger className="w-48"><SelectValue placeholder="All Departments" /></SelectTrigger><SelectContent><SelectItem value="all">All Departments</SelectItem>{orgUnits?.map((unit) => <SelectItem key={unit.id} value={unit.id}>{unit.sub_department_name ? `${unit.department_name} / ${unit.sub_department_name}` : unit.department_name}</SelectItem>)}</SelectContent></Select>
          <Select value={selectedStatus} onValueChange={setSelectedStatus}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent>{statusOptions.map((status) => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}</SelectContent></Select>
          <Select value={selectedPriority} onValueChange={setSelectedPriority}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent>{priorityOptions.map((priority) => <SelectItem key={priority.value} value={priority.value}>{priority.label}</SelectItem>)}</SelectContent></Select>
          <Button variant="outline" size="icon" onClick={() => { setSelectedModule("all"); setSelectedStatus("all"); setSelectedPriority("all"); setSelectedDepartment("all"); setSearchQuery(""); setMyItemsOnly(false); }}><Filter className="w-4 h-4" /></Button>
        </div>
      </div>

      <WorkItemsTable items={filteredItems} isLoading={isLoading} error={error} ngoMap={ngoMap} selectedItems={selectedItems} onToggleSelect={toggleSelectItem} onToggleSelectAll={toggleSelectAll} showSelection onCompleteForRecords={handleCompleteForRecords} completingItemId={completingItemId} onSyncTrello={(item) => handleSyncToTrello([item])} syncingTrelloItemId={syncingTrelloItemId} onRowClick={openWorkItemDrawer} emptyMessage="No active work items found. Completed items are sent to Admin Records and removed from this list." />

      <div className="mt-8">
        <WorkItemAdminRecordsPanel />
      </div>

      <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground"><span>Showing {filteredItems.length} of {workItems?.length || 0} active items</span><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled>Previous</Button><Button variant="outline" size="sm" disabled>Next</Button></div></div>
      <CreateWorkItemDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      <WorkItemDrawer workItemId={selectedWorkItemId} open={drawerOpen} onOpenChange={handleDrawerOpenChange} />
    </MainLayout>
  );
}
