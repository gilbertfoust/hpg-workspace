import { useQuery } from "@tanstack/react-query";
import { ensureSupabase } from "@/integrations/supabase/client";
import { fetchNgoFilterIds, type DashboardFilters } from "@/hooks/useDashboardData";
import { createDashboardRequestScope } from "@/lib/dashboardRequest";

export type ActionCenterReason =
  | "Overdue"
  | "Due this week"
  | "High priority"
  | "Waiting on NGO"
  | "Missing evidence"
  | "Unassigned";

export type ActionCenterItem = {
  id: string;
  title: string;
  ngoName: string;
  department: string;
  owner: string;
  module: string | null;
  status: string | null;
  priority: string | null;
  dueDate: string | null;
  reasons: ActionCenterReason[];
  urgencyScore: number;
};

export type ActionCenterSummary = Record<ActionCenterReason, number>;

const activeStatuses = [
  "draft",
  "not_started",
  "in_progress",
  "waiting_on_ngo",
  "waiting_on_hpg",
  "submitted",
  "under_review",
  "Draft",
  "Not Started",
  "In Progress",
  "Waiting on NGO",
  "Waiting on HPG",
  "Submitted",
  "Under Review",
];

const emptySummary = (): ActionCenterSummary => ({
  Overdue: 0,
  "Due this week": 0,
  "High priority": 0,
  "Waiting on NGO": 0,
  "Missing evidence": 0,
  Unassigned: 0,
});

const normalize = (value: string | null | undefined) =>
  (value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");

const formatStatus = (value: string | null | undefined) =>
  (value || "Unassigned").replace(/_/g, " ");

export const useDashboardActionCenter = (filters: DashboardFilters = {}) => {
  return useQuery({
    queryKey: ["dashboard-action-center", filters],
    queryFn: async ({ signal }) => {
      const supabase = ensureSupabase();
      const request = createDashboardRequestScope(signal);

      try {
      const { hasNgoFilters, ngoFilterIds } = await fetchNgoFilterIds(filters, request.signal);

      if (hasNgoFilters && ngoFilterIds.length === 0) {
        return { summary: emptySummary(), items: [] as ActionCenterItem[] };
      }

      let workItemsQuery = supabase
        .from("work_items")
        .select("id, title, ngo_id, department_id, owner_user_id, due_date, status, priority, evidence_required, evidence_status, module")
        .is("archived_at", null)
        .in("status", activeStatuses)
        .order("due_date", { ascending: true, nullsFirst: false });

      if (filters.module) {
        workItemsQuery = workItemsQuery.eq("module", filters.module);
      }
      if (hasNgoFilters) {
        workItemsQuery = workItemsQuery.in("ngo_id", ngoFilterIds);
      }

      const { data: workItems, error: workItemsError } = await workItemsQuery.abortSignal(request.signal);

      if (workItemsError) throw workItemsError;

      const safeWorkItems = workItems ?? [];
      const ngoIds = [...new Set(safeWorkItems.map((item) => item.ngo_id).filter(Boolean))];
      const departmentIds = [...new Set(safeWorkItems.map((item) => item.department_id).filter(Boolean))];
      const ownerIds = [...new Set(safeWorkItems.map((item) => item.owner_user_id).filter(Boolean))];

      const [
        { data: ngos, error: ngosError },
        { data: departments, error: departmentsError },
        { data: owners, error: ownersError },
      ] = await Promise.all([
        ngoIds.length
          ? supabase.from("ngos").select("id, legal_name, common_name").in("id", ngoIds).abortSignal(request.signal)
          : Promise.resolve({ data: [], error: null }),
        departmentIds.length
          ? supabase.from("org_units").select("id, department_name").in("id", departmentIds).abortSignal(request.signal)
          : Promise.resolve({ data: [], error: null }),
        ownerIds.length
          ? supabase.from("profiles").select("id, full_name, email").in("id", ownerIds).abortSignal(request.signal)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (ngosError) throw ngosError;
      if (departmentsError) throw departmentsError;
      if (ownersError) throw ownersError;

      const ngoMap = new Map((ngos ?? []).map((ngo) => [ngo.id, ngo.common_name || ngo.legal_name]));
      const departmentMap = new Map((departments ?? []).map((department) => [department.id, department.department_name]));
      const ownerMap = new Map((owners ?? []).map((owner) => [owner.id, owner.full_name || owner.email]));

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

      const summary = emptySummary();

      const items: ActionCenterItem[] = safeWorkItems
        .map((item) => {
          const reasons: ActionCenterReason[] = [];
          let urgencyScore = 0;
          const dueDate = item.due_date ? new Date(item.due_date) : null;
          const normalizedStatus = normalize(item.status);
          const normalizedPriority = normalize(item.priority);
          const normalizedEvidence = normalize(item.evidence_status);

          if (dueDate && dueDate < today) {
            reasons.push("Overdue");
            urgencyScore += 100;
          } else if (dueDate && dueDate <= in7Days) {
            reasons.push("Due this week");
            urgencyScore += 75;
          }

          if (["high", "urgent"].includes(normalizedPriority)) {
            reasons.push("High priority");
            urgencyScore += normalizedPriority === "urgent" ? 60 : 40;
          }

          if (normalizedStatus === "waiting_on_ngo") {
            reasons.push("Waiting on NGO");
            urgencyScore += 30;
          }

          if (item.evidence_required && normalizedEvidence !== "approved") {
            reasons.push("Missing evidence");
            urgencyScore += 35;
          }

          if (!item.owner_user_id || !item.department_id) {
            reasons.push("Unassigned");
            urgencyScore += 25;
          }

          reasons.forEach((reason) => {
            summary[reason] = (summary[reason] || 0) + 1;
          });

          return {
            id: item.id,
            title: item.title,
            ngoName: item.ngo_id ? ngoMap.get(item.ngo_id) || "Unknown NGO" : "Unassigned",
            department: item.department_id ? departmentMap.get(item.department_id) || "Unassigned" : "Unassigned",
            owner: item.owner_user_id ? ownerMap.get(item.owner_user_id) || "Unassigned" : "Unassigned",
            module: item.module,
            status: formatStatus(item.status),
            priority: item.priority,
            dueDate: item.due_date,
            reasons,
            urgencyScore,
          };
        })
        .filter((item) => item.reasons.length > 0)
        .sort((a, b) => {
          if (b.urgencyScore !== a.urgencyScore) return b.urgencyScore - a.urgencyScore;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        })
        .slice(0, 12);

      return { summary, items };
      } finally {
        request.cleanup();
      }
    },
  });
};
