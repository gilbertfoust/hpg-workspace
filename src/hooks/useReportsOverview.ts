import { useQuery } from "@tanstack/react-query";
import { format, subMonths } from "date-fns";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";

export interface MonthlyWorkItemMetric {
  key: string;
  label: string;
  count: number;
}

export interface ModuleDistribution {
  module: string;
  count: number;
}

export interface NgoHealthSnapshot {
  id: string;
  name: string;
  bundle: string | null;
  country: string | null;
  openItems: number;
  overdueItems: number;
  missingEvidenceItems: number;
}

export interface ReportsOverviewData {
  createdPerMonth: MonthlyWorkItemMetric[];
  completedPerMonth: MonthlyWorkItemMetric[];
  openByModule: ModuleDistribution[];
  ngoHealth: NgoHealthSnapshot[];
}

const ensureSupabase = () => {
  if (!supabase) {
    throw getSupabaseNotConfiguredError();
  }
};

const isOpenStatus = (status: string | null) =>
  status !== "complete" && status !== "canceled";

const moduleLabelMap: Record<string, string> = {
  ngo_coordination: "NGO Coordination",
  administration: "Administration",
  operations: "Operations",
  program: "Program",
  curriculum: "Curriculum",
  development: "Development",
  partnership: "Partnerships",
  marketing: "Marketing",
  communications: "Communications",
  hr: "HR",
  it: "IT",
  finance: "Finance",
  legal: "Legal",
};

const buildMonthWindow = (months: number) => {
  const now = new Date();
  return Array.from({ length: months }, (_, index) => {
    const date = subMonths(now, months - 1 - index);
    return {
      key: format(date, "yyyy-MM"),
      label: format(date, "MMM yyyy"),
    };
  });
};

export const useReportsOverview = (months = 12) => {
  return useQuery({
    queryKey: ["reports-overview", months],
    queryFn: async (): Promise<ReportsOverviewData> => {
      ensureSupabase();

      const [
        { data: workItems, error: workItemsError },
        { data: ngos, error: ngosError },
      ] = await Promise.all([
        supabase
          .from("work_items")
          .select("id, ngo_id, module, status, created_at, completed_at, due_date, evidence_status"),
        supabase
          .from("ngos")
          .select("id, common_name, legal_name, bundle, country")
          .order("common_name", { ascending: true }),
      ]);

      if (workItemsError) throw workItemsError;
      if (ngosError) throw ngosError;

      const safeWorkItems = workItems ?? [];
      const safeNgos = ngos ?? [];
      const monthWindow = buildMonthWindow(months);

      const createdCounts = new Map(monthWindow.map((m) => [m.key, 0]));
      const completedCounts = new Map(monthWindow.map((m) => [m.key, 0]));

      safeWorkItems.forEach((item) => {
        if (item.created_at) {
          const createdKey = format(new Date(item.created_at), "yyyy-MM");
          if (createdCounts.has(createdKey)) {
            createdCounts.set(createdKey, (createdCounts.get(createdKey) ?? 0) + 1);
          }
        }
        if (item.completed_at) {
          const completedKey = format(new Date(item.completed_at), "yyyy-MM");
          if (completedCounts.has(completedKey)) {
            completedCounts.set(completedKey, (completedCounts.get(completedKey) ?? 0) + 1);
          }
        }
      });

      const createdPerMonth = monthWindow.map((month) => ({
        key: month.key,
        label: month.label,
        count: createdCounts.get(month.key) ?? 0,
      }));

      const completedPerMonth = monthWindow.map((month) => ({
        key: month.key,
        label: month.label,
        count: completedCounts.get(month.key) ?? 0,
      }));

      const openByModuleMap = new Map<string, number>();
      const ngoHealthMap = new Map<string, NgoHealthSnapshot>();
      const today = new Date();

      safeNgos.forEach((ngo) => {
        ngoHealthMap.set(ngo.id, {
          id: ngo.id,
          name: ngo.common_name || ngo.legal_name,
          bundle: ngo.bundle,
          country: ngo.country,
          openItems: 0,
          overdueItems: 0,
          missingEvidenceItems: 0,
        });
      });

      safeWorkItems.forEach((item) => {
        if (isOpenStatus(item.status)) {
          const moduleLabel = moduleLabelMap[item.module ?? ""] ?? "Other";
          openByModuleMap.set(
            moduleLabel,
            (openByModuleMap.get(moduleLabel) ?? 0) + 1
          );

          if (item.ngo_id && ngoHealthMap.has(item.ngo_id)) {
            const snapshot = ngoHealthMap.get(item.ngo_id);
            if (snapshot) {
              snapshot.openItems += 1;
              if (item.due_date && new Date(item.due_date) < today) {
                snapshot.overdueItems += 1;
              }
              if (item.evidence_status === "missing") {
                snapshot.missingEvidenceItems += 1;
              }
            }
          }
        }
      });

      const openByModule = Array.from(openByModuleMap.entries())
        .map(([module, count]) => ({ module, count }))
        .sort((a, b) => b.count - a.count);

      const ngoHealth = Array.from(ngoHealthMap.values())
        .filter((ngo) => ngo.openItems > 0 || ngo.overdueItems > 0 || ngo.missingEvidenceItems > 0)
        .sort((a, b) => b.openItems - a.openItems);

      return {
        createdPerMonth,
        completedPerMonth,
        openByModule,
        ngoHealth,
      };
    },
  });
};
