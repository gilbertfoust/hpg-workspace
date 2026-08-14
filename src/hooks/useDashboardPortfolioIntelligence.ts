import { useQuery } from "@tanstack/react-query";
import { ensureSupabase } from "@/integrations/supabase/client";
import { fetchNgoFilterIds, type DashboardFilters } from "@/hooks/useDashboardData";
import { createDashboardRequestScope } from "@/lib/dashboardRequest";

const complianceStatuses = ["at_risk", "out_of_compliance", "non_compliant", "suspended", "remediation"];

const topEntry = (totals: Map<string, number>) => {
  let best = { label: "None", count: 0 };
  totals.forEach((count, label) => {
    if (count > best.count) best = { label, count };
  });
  return best;
};

export const useDashboardPortfolioIntelligence = (filters: DashboardFilters) => {
  return useQuery({
    queryKey: ["dashboard-portfolio-intelligence", filters],
    queryFn: async ({ signal }) => {
      const supabase = ensureSupabase();
      const request = createDashboardRequestScope(signal);
      try {
      const { hasNgoFilters, ngoFilterIds } = await fetchNgoFilterIds(filters, request.signal);

      if (hasNgoFilters && ngoFilterIds.length === 0) {
        return {
          totalNgos: 0,
          byCountry: [] as { label: string; count: number }[],
          byBundle: [] as { label: string; count: number }[],
          byStatus: [] as { label: string; count: number }[],
          largestCountry: "None",
          largestStatusGroup: "None",
          complianceRiskCount: 0,
        };
      }

      let query = supabase.from("ngos").select("id, status, country, bundle");
      if (filters.bundle) query = query.eq("bundle", filters.bundle);
      if (filters.country) query = query.eq("country", filters.country);
      if (filters.state) query = query.eq("state_province", filters.state);

      const { data, error } = await query.abortSignal(request.signal);
      if (error) throw error;

      const ngos = data ?? [];
      const countryTotals = new Map<string, number>();
      const bundleTotals = new Map<string, number>();
      const statusTotals = new Map<string, number>();
      let complianceRiskCount = 0;

      ngos.forEach((ngo) => {
        const country = ngo.country || "Unknown";
        const bundle = ngo.bundle || "Unassigned";
        const status = ngo.status || "Unknown";
        countryTotals.set(country, (countryTotals.get(country) || 0) + 1);
        bundleTotals.set(bundle, (bundleTotals.get(bundle) || 0) + 1);
        statusTotals.set(status, (statusTotals.get(status) || 0) + 1);
        if (complianceStatuses.includes((ngo.status || "").toLowerCase().replace(/[\s-]+/g, "_"))) {
          complianceRiskCount += 1;
        }
      });

      const toSortedList = (totals: Map<string, number>) =>
        [...totals.entries()]
          .map(([label, count]) => ({ label, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

      const largestCountry = topEntry(countryTotals);
      const largestStatusGroup = topEntry(statusTotals);

      return {
        totalNgos: ngos.length,
        byCountry: toSortedList(countryTotals),
        byBundle: toSortedList(bundleTotals),
        byStatus: toSortedList(statusTotals),
        largestCountry: largestCountry.label,
        largestStatusGroup: largestStatusGroup.label,
        complianceRiskCount,
      };
      } finally {
        request.cleanup();
      }
    },
  });
};
