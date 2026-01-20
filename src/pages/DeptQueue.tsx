import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  FileWarning,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { QueueFilters } from "@/components/work-items/QueueFilters";
import { WorkItemDrawer } from "@/components/work-items/WorkItemDrawer";
import { WorkItemsTable } from "@/components/work-items/WorkItemsTable";
import { KPICard } from "@/components/common/KPICard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useQueueFilters } from "@/hooks/useQueueFilters";
import { useNGOs } from "@/hooks/useNGOs";
import { useOrgUnits } from "@/hooks/useOrgUnits";
import { useInternalUsers } from "@/hooks/useProfiles";
import {
  useBulkBumpWorkItemDueDates,
  useBulkUpdateWorkItems,
  useDepartmentQueueWorkItems,
  WorkItemStatus,
} from "@/hooks/useWorkItems";
import { isSupabaseNotConfiguredError } from "@/integrations/supabase/client";
import { SupabaseNotConfiguredNotice } from "@/components/common/SupabaseNotConfiguredNotice";

const newStatuses: WorkItemStatus[] = ["draft", "not_started"];
const inProgressStatuses: WorkItemStatus[] = ["in_progress", "submitted", "under_review"];

export default function DeptQueue() {
  const { user } = useAuth();
  const { data: orgUnits, error: orgUnitsError, isLoading: orgUnitsLoading } = useOrgUnits();
  const { data: ngos, error: ngosError } = useNGOs();
  const { data: internalUsers } = useInternalUsers();

  const leadOrgUnits = useMemo(
    () => orgUnits?.filter((unit) => unit.lead_user_id === user?.id) || [],
    [orgUnits, user?.id]
  );

  const departmentIds = leadOrgUnits.map((unit) => unit.id);

  const { data: workItems, isLoading, error } = useDepartmentQueueWorkItems(departmentIds);

  const {
    filters,
    setStatuses,
    setModule,
    setNgoId,
    setDepartmentId,
    setStartDate,
    setEndDate,
    clearFilters,
  } = useQueueFilters();

  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<WorkItemStatus | "">("");
  const [bulkOwnerId, setBulkOwnerId] = useState<string>("");
  const [bumpDays, setBumpDays] = useState<string>("7");
  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const bulkUpdate = useBulkUpdateWorkItems();
  const bulkBumpDueDates = useBulkBumpWorkItemDueDates();

  if (
    isSupabaseNotConfiguredError(error) ||
    isSupabaseNotConfiguredError(orgUnitsError) ||
    isSupabaseNotConfiguredError(ngosError)
  ) {
    return (
      <MainLayout title="Dept Queue" subtitle="Department lead workload overview">
        <SupabaseNotConfiguredNotice />
      </MainLayout>
    );
  }

  const ngoMap = useMemo(() => {
    const map = new Map<string, string>();
    ngos?.forEach((ngo) => {
      map.set(ngo.id, ngo.common_name || ngo.legal_name);
    });
    return map;
  }, [ngos]);

  const filteredItems = useMemo(() => {
    if (!workItems) return [];
    return workItems.filter((item) => {
      if (filters.statuses.length > 0 && !filters.statuses.includes(item.status)) {
        return false;
      }
      if (filters.module !== "all" && item.module !== filters.module) {
        return false;
      }
      if (filters.ngoId !== "all" && item.ngo_id !== filters.ngoId) {
        return false;
      }
      if (filters.departmentId !== "all" && item.department_id !== filters.departmentId) {
        return false;
      }
      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        if (!item.due_date || new Date(item.due_date) < startDate) {
          return false;
        }
      }
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        if (!item.due_date || new Date(item.due_date) > endDate) {
          return false;
        }
      }
      return true;
    });
  }, [workItems, filters]);

  const today = new Date();
  const in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  const dueSoonCount = filteredItems.filter((item) => {
    if (!item.due_date) return false;
    const dueDate = new Date(item.due_date);
    return dueDate >= today && dueDate <= in7Days;
  }).length;

  const dueIn30Count = filteredItems.filter((item) => {
    if (!item.due_date) return false;
    const dueDate = new Date(item.due_date);
    return dueDate >= today && dueDate <= in30Days;
  }).length;

  const overdueCount = filteredItems.filter((item) => {
    if (!item.due_date) return false;
    return new Date(item.due_date) < today;
  }).length;

  const missingEvidenceCount = filteredItems.filter(
    (item) => item.evidence_required && item.evidence_status === "missing"
  ).length;

  const newItems = filteredItems.filter((item) => newStatuses.includes(item.status));
  const inProgressItems = filteredItems.filter((item) => inProgressStatuses.includes(item.status));
  const waitingOnNgoItems = filteredItems.filter((item) => item.status === "waiting_on_ngo");
  const waitingOnHpgItems = filteredItems.filter((item) => item.status === "waiting_on_hpg");
  const dueSoonOverdueItems = filteredItems.filter((item) => {
    if (!item.due_date) return false;
    const dueDate = new Date(item.due_date);
    return dueDate < today || (dueDate >= today && dueDate <= in7Days);
  });

  const toggleSelectItem = (id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = (sectionItems: { id: string }[]) => {
    const sectionIds = sectionItems.map((item) => item.id);
    const allSelected = sectionIds.every((id) => selectedItems.includes(id));
    if (allSelected) {
      setSelectedItems((prev) => prev.filter((id) => !sectionIds.includes(id)));
    } else {
      setSelectedItems((prev) => [...new Set([...prev, ...sectionIds])]);
    }
  };

  const selectedWorkItems = filteredItems.filter((item) => selectedItems.includes(item.id));

  const handleBulkStatus = () => {
    if (!bulkStatus || selectedItems.length === 0) return;
    bulkUpdate.mutate({
      ids: selectedItems,
      updates: { status: bulkStatus },
    });
  };

  const handleBulkOwner = () => {
    if (!bulkOwnerId || selectedItems.length === 0) return;
    bulkUpdate.mutate({
      ids: selectedItems,
      updates: { owner_user_id: bulkOwnerId },
    });
  };

  const handleBumpDueDates = () => {
    const bumpDaysValue = Number(bumpDays);
    if (Number.isNaN(bumpDaysValue) || bumpDaysValue === 0 || selectedItems.length === 0) {
      return;
    }
    bulkBumpDueDates.mutate({ items: selectedWorkItems, bumpDays: bumpDaysValue });
  };

  const openWorkItemDrawer = (id: string) => {
    setSelectedWorkItemId(id);
    setDrawerOpen(true);
  };

  const showEmptyLeadState = !orgUnitsLoading && leadOrgUnits.length === 0;

  return (
    <MainLayout title="Dept Queue" subtitle="Department lead workflow queues">
      {showEmptyLeadState ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            You are not assigned as a department lead yet.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <KPICard
              title="Due in 7 Days"
              value={dueSoonCount}
              subtitle={`${dueIn30Count} due in 30 days`}
              icon={<CalendarClock className="w-5 h-5" />}
              variant="warning"
            />
            <KPICard
              title="Overdue"
              value={overdueCount}
              subtitle="Needs attention"
              icon={<AlertTriangle className="w-5 h-5" />}
              variant="danger"
            />
            <KPICard
              title="Missing Evidence"
              value={missingEvidenceCount}
              subtitle="Evidence required"
              icon={<FileWarning className="w-5 h-5" />}
            />
          </div>

          <QueueFilters
            statuses={filters.statuses}
            module={filters.module}
            ngoId={filters.ngoId}
            departmentId={filters.departmentId}
            startDate={filters.startDate}
            endDate={filters.endDate}
            ngos={ngos}
            orgUnits={leadOrgUnits}
            onStatusesChange={setStatuses}
            onModuleChange={setModule}
            onNgoChange={setNgoId}
            onDepartmentChange={setDepartmentId}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            onClear={clearFilters}
          />

          {selectedItems.length > 0 && (
            <Card className="mb-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">
                  Bulk Actions ({selectedItems.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-end">
                <div className="flex flex-col gap-2">
                  <span className="text-xs text-muted-foreground">Change status</span>
                  <div className="flex items-center gap-2">
                    <Select value={bulkStatus} onValueChange={(value) => setBulkStatus(value as WorkItemStatus)}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_started">Not Started</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="waiting_on_ngo">Waiting on NGO</SelectItem>
                        <SelectItem value="waiting_on_hpg">Waiting on HPG</SelectItem>
                        <SelectItem value="submitted">Submitted</SelectItem>
                        <SelectItem value="under_review">Under Review</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="complete">Complete</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      onClick={handleBulkStatus}
                      disabled={bulkUpdate.isPending}
                    >
                      Apply
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-xs text-muted-foreground">Reassign owner</span>
                  <div className="flex items-center gap-2">
                    <Select value={bulkOwnerId} onValueChange={setBulkOwnerId}>
                      <SelectTrigger className="w-56">
                        <SelectValue placeholder="Select owner" />
                      </SelectTrigger>
                      <SelectContent>
                        {(internalUsers || []).map((profile) => (
                          <SelectItem key={profile.id} value={profile.id}>
                            {profile.full_name || profile.email || "Unknown User"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      onClick={handleBulkOwner}
                      disabled={bulkUpdate.isPending}
                    >
                      Assign
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-xs text-muted-foreground">Bump due dates</span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      value={bumpDays}
                      onChange={(event) => setBumpDays(event.target.value)}
                      className="w-28"
                    />
                    <span className="text-sm text-muted-foreground">days</span>
                    <Button
                      variant="outline"
                      onClick={handleBumpDueDates}
                      disabled={bulkBumpDueDates.isPending}
                    >
                      Bump
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">
                  New / Not Started ({newItems.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <WorkItemsTable
                  items={newItems}
                  isLoading={isLoading}
                  error={error}
                  ngoMap={ngoMap}
                  selectedItems={selectedItems}
                  onToggleSelect={toggleSelectItem}
                  onToggleSelectAll={() => toggleSelectAll(newItems)}
                  showSelection
                  onRowClick={openWorkItemDrawer}
                  emptyMessage="No new work items right now."
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">
                  In Progress ({inProgressItems.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <WorkItemsTable
                  items={inProgressItems}
                  isLoading={isLoading}
                  error={error}
                  ngoMap={ngoMap}
                  selectedItems={selectedItems}
                  onToggleSelect={toggleSelectItem}
                  onToggleSelectAll={() => toggleSelectAll(inProgressItems)}
                  showSelection
                  onRowClick={openWorkItemDrawer}
                  emptyMessage="No items in progress."
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">
                  Waiting on NGO ({waitingOnNgoItems.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <WorkItemsTable
                  items={waitingOnNgoItems}
                  isLoading={isLoading}
                  error={error}
                  ngoMap={ngoMap}
                  selectedItems={selectedItems}
                  onToggleSelect={toggleSelectItem}
                  onToggleSelectAll={() => toggleSelectAll(waitingOnNgoItems)}
                  showSelection
                  onRowClick={openWorkItemDrawer}
                  emptyMessage="No items waiting on NGOs."
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">
                  Waiting on HPG (Other Depts) ({waitingOnHpgItems.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <WorkItemsTable
                  items={waitingOnHpgItems}
                  isLoading={isLoading}
                  error={error}
                  ngoMap={ngoMap}
                  selectedItems={selectedItems}
                  onToggleSelect={toggleSelectItem}
                  onToggleSelectAll={() => toggleSelectAll(waitingOnHpgItems)}
                  showSelection
                  onRowClick={openWorkItemDrawer}
                  emptyMessage="No items waiting on other departments."
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">
                  Due Soon / Overdue ({dueSoonOverdueItems.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <WorkItemsTable
                  items={dueSoonOverdueItems}
                  isLoading={isLoading}
                  error={error}
                  ngoMap={ngoMap}
                  onRowClick={openWorkItemDrawer}
                  showActions={false}
                  emptyMessage="No upcoming or overdue items."
                />
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <WorkItemDrawer
        workItemId={selectedWorkItemId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </MainLayout>
  );
}
