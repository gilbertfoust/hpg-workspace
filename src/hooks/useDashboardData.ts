import { useQuery } from "@tanstack/react-query";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { ModuleType, WorkItemStatus } from "@/hooks/useWorkItems";

export type DashboardFilters = {
  bundle?: string;
  country?: string;
  state?: string;
  module?: ModuleType;
};

export type DashboardEvidenceRow = {
  id: string;
  ngoName: string;
  department: string;
  owner: string;
  dueDate: string | null;
};

export type DashboardAtRiskRow = {
  id: string;
  name: string;
  bundle: string | null;
  location: string;
};

export type DepartmentWorkload = {
  department: string;
  count: number;
};

export type DashboardKpis = {
  dueIn7Days: number;
  dueIn30Days: number;
  dueIn90Days: number;
  overdue: number;
  atRiskNgos: number;
  pendingDocuments: number;
};

export type DashboardData = {
  kpis: DashboardKpis;
  workloadByDepartment: DepartmentWorkload[];
  evidencePending: DashboardEvidenceRow[];
  atRiskNgos: DashboardAtRiskRow[];
};

const ACTIVE_STATUSES: WorkItemStatus[] = [
  "not_started",
  "in_progress",
  "waiting_on_ngo",
  "waiting_on_hpg",
  "submitted",
  "under_review",
];

const ensureSupabase = () => {
  if (!supabase) {
    throw getSupabaseNotConfiguredError();
  }
};

const uniqueSorted = (values: (string | null | undefined)[]) => {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
    .sort((a, b) => a.localeCompare(b));
};

export const useDashboardFilters = () => {
  return useQuery({
    queryKey: ["dashboard-filters"],
    queryFn: async () => {
      ensureSupabase();
      const [{ data: ngoData, error: ngoError }, { data: workItemData, error: workItemError }] =
        await Promise.all([
          supabase.from("ngos").select("bundle, country, state_province"),
          supabase.from("work_items").select("module"),
        ]);

      if (ngoError) throw ngoError;
      if (workItemError) throw workItemError;

      return {
        bundles: uniqueSorted(ngoData?.map((row) => row.bundle) ?? []),
        countries: uniqueSorted(ngoData?.map((row) => row.country) ?? []),
        states: uniqueSorted(ngoData?.map((row) => row.state_province) ?? []),
        modules: uniqueSorted(workItemData?.map((row) => row.module) ?? []),
      };
    },
  });
};

export const useDashboardData = (filters: DashboardFilters) => {
  return useQuery({
    queryKey: ["dashboard-data", filters],
    queryFn: async (): Promise<DashboardData> => {
      ensureSupabase();
      const hasNgoFilters = Boolean(filters.bundle || filters.country || filters.state);

      let ngoFilterQuery = supabase.from("ngos").select("id");
      if (filters.bundle) {
        ngoFilterQuery = ngoFilterQuery.eq("bundle", filters.bundle);
      }
      if (filters.country) {
        ngoFilterQuery = ngoFilterQuery.eq("country", filters.country);
      }
      if (filters.state) {
        ngoFilterQuery = ngoFilterQuery.eq("state_province", filters.state);
      }

      const { data: ngoFilterData, error: ngoFilterError } = await ngoFilterQuery;
      if (ngoFilterError) throw ngoFilterError;

      const ngoFilterIds = ngoFilterData?.map((ngo) => ngo.id) ?? [];
      if (hasNgoFilters && ngoFilterIds.length === 0) {
        return {
          kpis: {
            dueIn7Days: 0,
            dueIn30Days: 0,
            dueIn90Days: 0,
            overdue: 0,
            atRiskNgos: 0,
            pendingDocuments: 0,
          },
          workloadByDepartment: [],
          evidencePending: [],
          atRiskNgos: [],
        };
      }

      let workItemsQuery = supabase
        .from("work_items")
        .select(
          "id, ngo_id, department_id, owner_user_id, due_date, status, evidence_required, evidence_status, module",
        )
        .in("status", ACTIVE_STATUSES);

      if (filters.module) {
        workItemsQuery = workItemsQuery.eq("module", filters.module);
      }
      if (hasNgoFilters) {
        workItemsQuery = workItemsQuery.in("ngo_id", ngoFilterIds);
      }

      const { data: workItems, error: workItemsError } = await workItemsQuery;
      if (workItemsError) throw workItemsError;

      const workItemIds = workItems?.map((item) => item.id) ?? [];

      let atRiskQuery = supabase
        .from("ngos")
        .select("id, legal_name, common_name, bundle, country, state_province, city")
        .eq("status", "at_risk")
        .order("legal_name", { ascending: true });

      if (filters.bundle) {
        atRiskQuery = atRiskQuery.eq("bundle", filters.bundle);
      }
      if (filters.country) {
        atRiskQuery = atRiskQuery.eq("country", filters.country);
      }
      if (filters.state) {
        atRiskQuery = atRiskQuery.eq("state_province", filters.state);
      }

      const { data: atRiskData, error: atRiskError } = await atRiskQuery;
      if (atRiskError) throw atRiskError;

      const ngoIdsForMap = uniqueSorted(
        (workItems ?? []).map((item) => item.ngo_id).filter(Boolean),
      );

      const [{ data: ngoMapData, error: ngoMapError }, { data: orgUnits, error: orgUnitsError }] =
        await Promise.all([
          ngoIdsForMap.length
            ? supabase.from("ngos").select("id, legal_name, common_name").in("id", ngoIdsForMap)
            : Promise.resolve({ data: [], error: null }),
          supabase.from("org_units").select("id, department_name"),
        ]);

      if (ngoMapError) throw ngoMapError;
      if (orgUnitsError) throw orgUnitsError;

      const ownerIds = uniqueSorted(
        (workItems ?? []).map((item) => item.owner_user_id).filter(Boolean),
      );

      const { data: ownerProfiles, error: ownerError } = ownerIds.length
        ? await supabase.from("profiles").select("id, full_name, email").in("id", ownerIds)
        : { data: [], error: null };

      if (ownerError) throw ownerError;

      let documentQuery = supabase
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("review_status", "Pending");

      if (filters.module) {
        if (workItemIds.length === 0) {
          documentQuery = documentQuery.in("work_item_id", ["__none__"]);
        } else {
          documentQuery = documentQuery.in("work_item_id", workItemIds);
        }
      } else if (hasNgoFilters) {
        documentQuery = documentQuery.in("ngo_id", ngoFilterIds);
      }

      const { count: pendingDocumentsCount, error: documentError } = await documentQuery;
      if (documentError) throw documentError;

      const ngoNameMap = new Map(
        (ngoMapData ?? []).map((ngo) => [ngo.id, ngo.common_name || ngo.legal_name]),
      );
      const departmentMap = new Map(
        (orgUnits ?? []).map((unit) => [unit.id, unit.department_name]),
      );
      const ownerMap = new Map(
        (ownerProfiles ?? []).map((profile) => [
          profile.id,
          profile.full_name || profile.email || "Unassigned",
        ]),
      );

      const today = new Date();
      const in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      const in90Days = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);

      const dueIn7Days = (workItems ?? []).filter((item) => {
        if (!item.due_date) return false;
        const dueDate = new Date(item.due_date);
        return dueDate >= today && dueDate <= in7Days;
      }).length;

      const dueIn30Days = (workItems ?? []).filter((item) => {
        if (!item.due_date) return false;
        const dueDate = new Date(item.due_date);
        return dueDate >= today && dueDate <= in30Days;
      }).length;

      const dueIn90Days = (workItems ?? []).filter((item) => {
        if (!item.due_date) return false;
        const dueDate = new Date(item.due_date);
        return dueDate >= today && dueDate <= in90Days;
      }).length;

      const overdue = (workItems ?? []).filter((item) => {
        if (!item.due_date) return false;
        const dueDate = new Date(item.due_date);
        return dueDate < today;
      }).length;

      const evidencePending = (workItems ?? [])
        .filter((item) => item.evidence_required && item.evidence_status !== "approved")
        .map((item) => ({
          id: item.id,
          ngoName: item.ngo_id ? ngoNameMap.get(item.ngo_id) || "Unknown NGO" : "Unassigned",
          department: item.department_id
            ? departmentMap.get(item.department_id) || "Unassigned"
            : "Unassigned",
          owner: item.owner_user_id ? ownerMap.get(item.owner_user_id) || "Unassigned" : "Unassigned",
          dueDate: item.due_date,
        }))
        .sort((a, b) => {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        })
        .slice(0, 50); // Limit to top 50 for performance

      const workloadTotals = new Map<string, number>();
      (workItems ?? []).forEach((item) => {
        const department = item.department_id
          ? departmentMap.get(item.department_id) || "Unassigned"
          : "Unassigned";
        workloadTotals.set(department, (workloadTotals.get(department) || 0) + 1);
      });

      const workloadByDepartment = [...workloadTotals.entries()]
        .map(([department, count]) => ({ department, count }))
        .sort((a, b) => b.count - a.count);

      const atRiskNgos = (atRiskData ?? [])
        .map((ngo) => ({
          id: ngo.id,
          name: ngo.common_name || ngo.legal_name,
          bundle: ngo.bundle,
          location: [ngo.city, ngo.state_province, ngo.country].filter(Boolean).join(", ") || "-",
        }))
        .slice(0, 20); // Limit to top 20 for performance

      return {
        kpis: {
          dueIn7Days,
          dueIn30Days,
          dueIn90Days,
          overdue,
          atRiskNgos: atRiskNgos.length,
          pendingDocuments: pendingDocumentsCount ?? 0,
        },
        workloadByDepartment,
        evidencePending,
        atRiskNgos,
      };
    },
  });
};
