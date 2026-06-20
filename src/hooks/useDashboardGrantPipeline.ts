import { useQuery } from "@tanstack/react-query";
import { ensureSupabase } from "@/integrations/supabase/client";

const safeCount = async (table: string) => {
  try {
    const supabase = ensureSupabase();
    const { count, error } = await (supabase as any)
      .from(table)
      .select("id", { count: "exact", head: true });
    if (error) return { available: false, count: 0 };
    return { available: true, count: count ?? 0 };
  } catch {
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
    queryFn: async () => {
      const supabase = ensureSupabase();

      const [opportunities, applications, grantWorkItems] = await Promise.all([
        safeCount("grant_opportunities"),
        safeCount("grant_applications"),
        (async () => {
          try {
            const { count, error } = await supabase
              .from("work_items")
              .select("id", { count: "exact", head: true })
              .is("archived_at", null)
              .eq("module", "grants");
            if (error) return { available: false, count: 0 };
            return { available: true, count: count ?? 0 };
          } catch {
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
            .select("status");
          if (!error && data) {
            activeApplications = data.filter((row) =>
              activeApplicationStatuses.includes((row.status || "").toLowerCase().replace(/[\s-]+/g, "_")),
            ).length;
          } else {
            applicationsAvailable = false;
          }
        } catch {
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
    },
  });
};
