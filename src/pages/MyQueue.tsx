import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { QueueFilters } from "@/components/work-items/QueueFilters";
import { WorkItemDrawer } from "@/components/work-items/WorkItemDrawer";
import { WorkItemsTable } from "@/components/work-items/WorkItemsTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useQueueFilters } from "@/hooks/useQueueFilters";
import { useNGOs } from "@/hooks/useNGOs";
import { useOrgUnits } from "@/hooks/useOrgUnits";
import { useMyQueueWorkItems, WorkItemStatus } from "@/hooks/useWorkItems";
import { isSupabaseNotConfiguredError } from "@/integrations/supabase/client";
import { SupabaseNotConfiguredNotice } from "@/components/common/SupabaseNotConfiguredNotice";

const activeStatuses: WorkItemStatus[] = [
  "draft",
  "not_started",
  "in_progress",
  "waiting_on_ngo",
  "waiting_on_hpg",
  "submitted",
  "under_review",
  "approved",
];

export default function MyQueue() {
  const { user } = useAuth();
  const { data: workItems, isLoading, error } = useMyQueueWorkItems();
  const { data: ngos, error: ngosError } = useNGOs();
  const { data: orgUnits, error: orgUnitsError } = useOrgUnits();
  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  if (
    isSupabaseNotConfiguredError(error) ||
    isSupabaseNotConfiguredError(ngosError) ||
    isSupabaseNotConfiguredError(orgUnitsError)
  ) {
    return (
      <MainLayout title="My Queue" subtitle="Your work items and approvals">
        <SupabaseNotConfiguredNotice />
      </MainLayout>
    );
  }

  const today = new Date();
  const in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  const dueSoonItems = filteredItems.filter((item) => {
    if (!item.due_date || !activeStatuses.includes(item.status)) return false;
    const dueDate = new Date(item.due_date);
    return dueDate >= today && dueDate <= in7Days;
  });

  const overdueItems = filteredItems.filter((item) => {
    if (!item.due_date || !activeStatuses.includes(item.status)) return false;
    return new Date(item.due_date) < today;
  });

  const waitingOnMeItems = filteredItems.filter((item) => {
    if (!user?.id) return false;
    const awaitingApproval =
      item.approval_required && item.approver_user_id === user.id && activeStatuses.includes(item.status);
    const awaitingEvidenceReview =
      item.evidence_required &&
      ["uploaded", "under_review"].includes(item.evidence_status) &&
      item.approver_user_id === user.id;
    return awaitingApproval || awaitingEvidenceReview;
  });

  const assignedToMeItems = filteredItems.filter((item) => item.owner_user_id === user?.id);

  const openWorkItemDrawer = (id: string) => {
    setSelectedWorkItemId(id);
    setDrawerOpen(true);
  };

  return (
    <MainLayout title="My Queue" subtitle="Your active assignments and approvals">
      <QueueFilters
        statuses={filters.statuses}
        module={filters.module}
        ngoId={filters.ngoId}
        departmentId={filters.departmentId}
        startDate={filters.startDate}
        endDate={filters.endDate}
        ngos={ngos}
        orgUnits={orgUnits}
        onStatusesChange={setStatuses}
        onModuleChange={setModule}
        onNgoChange={setNgoId}
        onDepartmentChange={setDepartmentId}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onClear={clearFilters}
      />

      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">
              Due Soon ({dueSoonItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <WorkItemsTable
              items={dueSoonItems}
              isLoading={isLoading}
              error={error}
              ngoMap={ngoMap}
              onRowClick={openWorkItemDrawer}
              showActions={false}
              emptyMessage="No work items due in the next 7 days."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">
              Overdue ({overdueItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <WorkItemsTable
              items={overdueItems}
              isLoading={isLoading}
              error={error}
              ngoMap={ngoMap}
              onRowClick={openWorkItemDrawer}
              showActions={false}
              emptyMessage="No overdue work items right now."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">
              Waiting on Me ({waitingOnMeItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <WorkItemsTable
              items={waitingOnMeItems}
              isLoading={isLoading}
              error={error}
              ngoMap={ngoMap}
              onRowClick={openWorkItemDrawer}
              showActions={false}
              emptyMessage="No approvals or evidence reviews waiting on you."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">
              Assigned to Me (All) ({assignedToMeItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <WorkItemsTable
              items={assignedToMeItems}
              isLoading={isLoading}
              error={error}
              ngoMap={ngoMap}
              onRowClick={openWorkItemDrawer}
              showActions={false}
              emptyMessage="No assigned work items yet."
            />
          </CardContent>
        </Card>
      </div>

      <WorkItemDrawer
        workItemId={selectedWorkItemId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </MainLayout>
  );
}
