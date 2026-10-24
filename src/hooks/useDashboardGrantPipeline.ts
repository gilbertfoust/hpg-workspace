import { useQuery } from "@tanstack/react-query";
import { ensureSupabase } from "@/integrations/supabase/client";
import { createDashboardRequestScope } from "@/lib/dashboardRequest";

type DashboardCountTable = "grant_opportunities" | "grant_applications";

const safeCount = async (table: DashboardCountTable, signal: AbortSignal) => {
  try {
    const supabase = ensureSupabase();
    const { count, error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .abortSignal(signal);
    if (error) return { available: false, count: 0 };
    return { available: true, count: count ?? 0 };
  } catch (error) {
    if (signal.aborted) throw error;
    return { available: false, count: 0 };
  }
};

const activeApplicationStatuses = [
  "draft",
  "in_progress",
  "submitted",
  "under_review",
  "pending",
  "active",
];

export const useDashboardGrantPipeline = () => {
  return useQuery({
    queryKey: ["dashboard-grant-pipeline"],
    queryFn: async ({ signal }) => {
      const supabase = ensureSupabase();
      const request = createDashboardRequestScope(signal);

      try {
      const [opportunities, applications, grantWorkItems] = await Promise.all([
        safeCount("grant_opportunities", request.signal),
        safeCount("grant_applications", request.signal),
        (async () => {
          try {
            const { count, error } = await supabase
              .from("work_items")
              .select("id", { count: "exact", head: true })
              .is("archived_at", null)
              .eq("module", "grants")
              .abortSignal(request.signal);
            if (error) return { available: false, count: 0 };
            return { available: true, count: count ?? 0 };
          } catch (error) {
            if (request.signal.aborted) throw error;
            return { available: false, count: 0 };
          }
        })(),
      ]);

      let activeApplications = 0;
      let applicationsAvailable = applications.available;

      if (applications.available) {
        try {
          const { data, error } = await supabase
            .from("grant_applications")
            .select("status")
            .abortSignal(request.signal);
          if (!error && data) {
            activeApplications = data.filter((row) =>
              activeApplicationStatuses.includes((row.status || "").toLowerCase().replace(/[\s-]+/g, "_")),
            ).length;
          } else {
            applicationsAvailable = false;
          }
        } catch (error) {
          if (request.signal.aborted) throw error;
          applicationsAvailable = false;
        }
      }

      const connectedSources = [opportunities, applications, grantWorkItems].filter((s) => s.available).length;
      const partiallyConnected = connectedSources > 0 && connectedSources < 3;

      return {
        opportunitiesCount: opportunities.count,
        applicationsCount: applications.count,
        activeApplicationsCount: activeApplications,
        grantWorkItemsCount: grantWorkItems.count,
        opportunitiesAvailable: opportunities.available,
        applicationsAvailable,
        grantWorkItemsAvailable: grantWorkItems.available,
        partiallyConnected,
      };
      } finally {
        request.cleanup();
      }
    },
  });
};
