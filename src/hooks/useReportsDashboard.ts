import { useQuery } from "@tanstack/react-query";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";

export interface DepartmentWorkload {
  department: string;
  openCount: number;
}

export interface AtRiskNgoSummary {
  id: string;
  name: string;
  bundle: string | null;
  coordinatorName: string | null;
  coordinatorEmail: string | null;
}

export interface ReportsDashboardData {
  kpis: {
    activeNgos: number;
    atRiskNgos: number;
    openWorkItems: number;
    overdueWorkItems: number;
  };
  workloadByDepartment: DepartmentWorkload[];
  atRiskNgos: AtRiskNgoSummary[];
}

const ensureSupabase = () => {
  if (!supabase) {
    throw getSupabaseNotConfiguredError();
  }
};

const isOpenStatus = (status: string | null) =>
  status !== "complete" && status !== "canceled";

export const useReportsDashboard = () => {
  return useQuery({
    queryKey: ["reports-dashboard"],
    queryFn: async (): Promise<ReportsDashboardData> => {
      ensureSupabase();

      const [
        { data: workItems, error: workItemsError },
        { data: ngos, error: ngosError },
        { data: orgUnits, error: orgUnitsError },
        { data: profiles, error: profilesError },
      ] = await Promise.all([
        supabase
          .from("work_items")
          .select("id, status, due_date, department_id")
          .order("created_at", { ascending: false }),
        supabase
          .from("ngos")
          .select("id, status, bundle, common_name, legal_name, ngo_coordinator_user_id")
          .order("created_at", { ascending: false }),
        supabase.from("org_units").select("id, department_name"),
        supabase.from("profiles").select("id, full_name, email"),
      ]);

      if (workItemsError) throw workItemsError;
      if (ngosError) throw ngosError;
      if (orgUnitsError) throw orgUnitsError;
      if (profilesError) throw profilesError;

      const safeWorkItems = workItems ?? [];
      const safeNgos = ngos ?? [];
      const safeOrgUnits = orgUnits ?? [];
      const safeProfiles = profiles ?? [];

      const today = new Date();
      const openWorkItems = safeWorkItems.filter((item) => isOpenStatus(item.status));
      const overdueWorkItems = openWorkItems.filter((item) => {
        if (!item.due_date) return false;
        return new Date(item.due_date) < today;
      });

      const activeNgos = safeNgos.filter((ngo) => ngo.status === "active").length;
      const atRiskNgos = safeNgos.filter((ngo) => ngo.status === "at_risk");

      const departmentMap = new Map<string, string>();
      safeOrgUnits.forEach((unit) => {
        departmentMap.set(unit.id, unit.department_name);
      });

      const workloadMap = new Map<string, number>();
      openWorkItems.forEach((item) => {
        const department = item.department_id
          ? departmentMap.get(item.department_id) ?? "Unassigned"
          : "Unassigned";
        workloadMap.set(department, (workloadMap.get(department) ?? 0) + 1);
      });

      const workloadByDepartment = Array.from(workloadMap.entries())
        .map(([department, openCount]) => ({ department, openCount }))
        .sort((a, b) => b.openCount - a.openCount);

      const profileMap = new Map(
        safeProfiles.map((profile) => [profile.id, profile])
      );

      const atRiskSummaries = atRiskNgos.map((ngo) => {
        const coordinator = ngo.ngo_coordinator_user_id
          ? profileMap.get(ngo.ngo_coordinator_user_id)
          : undefined;

        return {
          id: ngo.id,
          name: ngo.common_name || ngo.legal_name,
          bundle: ngo.bundle,
          coordinatorName: coordinator?.full_name ?? null,
          coordinatorEmail: coordinator?.email ?? null,
        } satisfies AtRiskNgoSummary;
      });

      return {
        kpis: {
          activeNgos,
          atRiskNgos: atRiskNgos.length,
          openWorkItems: openWorkItems.length,
          overdueWorkItems: overdueWorkItems.length,
        },
        workloadByDepartment,
        atRiskNgos: atRiskSummaries,
      };
    },
  });
};
