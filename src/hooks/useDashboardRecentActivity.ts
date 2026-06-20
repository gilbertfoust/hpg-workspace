import { useQuery } from "@tanstack/react-query";
import { ensureSupabase } from "@/integrations/supabase/client";
import { fetchNgoFilterIds, type DashboardFilters } from "@/hooks/useDashboardData";

export type RecentActivityType =
  | "work_item"
  | "document"
  | "form_submission"
  | "grant_opportunity"
  | "grant_application"
  | "ngo"
  | "audit";

export type RecentActivityItem = {
  id: string;
  type: RecentActivityType;
  title: string;
  description: string;
  createdAt: string;
  path: string;
};

const safeQuery = async <T>(label: string, queryBuilder: () => Promise<{ data: T[] | null; error: any }>) => {
  try {
    const { data, error } = await queryBuilder();
    if (error) {
      console.warn(`Recent activity query failed for ${label}:`, error.message);
      return [] as T[];
    }
    return data ?? [];
  } catch (error) {
    console.warn(`Recent activity query unavailable for ${label}:`, error);
    return [] as T[];
  }
};

const formatEntityName = (primary?: string | null, fallback?: string | null) => primary || fallback || "Untitled";

export const useDashboardRecentActivity = (filters: DashboardFilters = {}) => {
  return useQuery({
    queryKey: ["dashboard-recent-activity", filters],
    queryFn: async (): Promise<RecentActivityItem[]> => {
      const supabase = ensureSupabase();
      const { hasNgoFilters, ngoFilterIds } = await fetchNgoFilterIds(filters);
      const hasFilters = Boolean(filters.module || hasNgoFilters);

      if (hasNgoFilters && ngoFilterIds.length === 0) {
        return [];
      }

      const [workItems, documents, formSubmissions, grantOpportunities, grantApplications, ngos, auditLogs] = await Promise.all([
        hasNgoFilters && ngoFilterIds.length === 0
          ? Promise.resolve([])
          : safeQuery("work_items", () => {
              let query = supabase
                .from("work_items")
                .select("id, title, module, status, created_at")
                .order("created_at", { ascending: false })
                .limit(8);

              if (filters.module) {
                query = query.eq("module", filters.module);
              }
              if (hasNgoFilters) {
                query = query.in("ngo_id", ngoFilterIds);
              }

              return query;
            }),
        hasNgoFilters && ngoFilterIds.length === 0
          ? Promise.resolve([])
          : safeQuery("documents", () => {
              let query = supabase
                .from("documents")
                .select("id, title, file_name, review_status, created_at")
                .order("created_at", { ascending: false })
                .limit(8);

              if (hasNgoFilters) {
                query = query.in("ngo_id", ngoFilterIds);
              }

              return query;
            }),
        hasFilters
          ? Promise.resolve([])
          : safeQuery("form_submissions", () =>
              supabase
                .from("form_submissions")
                .select("id, status, created_at")
                .order("created_at", { ascending: false })
                .limit(8),
            ),
        hasFilters
          ? Promise.resolve([])
          : safeQuery("grant_opportunities", () =>
              supabase
                .from("grant_opportunities")
                .select("id, title, funder_name, created_at")
                .order("created_at", { ascending: false })
                .limit(8),
            ),
        hasFilters
          ? Promise.resolve([])
          : safeQuery("grant_applications", () =>
              supabase
                .from("grant_applications")
                .select("id, status, stage, created_at")
                .order("created_at", { ascending: false })
                .limit(8),
            ),
        safeQuery("ngos", () => {
          let query = supabase
            .from("ngos")
            .select("id, legal_name, common_name, status, created_at, updated_at")
            .order("updated_at", { ascending: false })
            .limit(8);

          if (filters.bundle) {
            query = query.eq("bundle", filters.bundle);
          }
          if (filters.country) {
            query = query.eq("country", filters.country);
          }
          if (filters.state) {
            query = query.eq("state_province", filters.state);
          }

          return query;
        }),
        hasFilters
          ? Promise.resolve([])
          : safeQuery("audit_log", () =>
              supabase
                .from("audit_log")
                .select("id, action_type, entity_type, entity_id, created_at")
                .order("created_at", { ascending: false })
                .limit(8),
            ),
      ]);

      const activity: RecentActivityItem[] = [
        ...workItems.map((item: any) => ({
          id: `work_item-${item.id}`,
          type: "work_item" as const,
          title: item.title || "Work item created",
          description: [item.module, item.status].filter(Boolean).join(" • ") || "New work item",
          createdAt: item.created_at,
          path: `/work-items?highlight=${item.id}`,
        })),
        ...documents.map((item: any) => ({
          id: `document-${item.id}`,
          type: "document" as const,
          title: formatEntityName(item.title, item.file_name),
          description: item.review_status ? `Document review: ${item.review_status}` : "Document uploaded",
          createdAt: item.created_at,
          path: "/documents",
        })),
        ...formSubmissions.map((item: any) => ({
          id: `form_submission-${item.id}`,
          type: "form_submission" as const,
          title: "Form submission received",
          description: item.status ? `Status: ${item.status}` : "New form submission",
          createdAt: item.created_at,
          path: "/forms/submissions",
        })),
        ...grantOpportunities.map((item: any) => ({
          id: `grant_opportunity-${item.id}`,
          type: "grant_opportunity" as const,
          title: item.title || "Grant opportunity added",
          description: item.funder_name ? `Funder: ${item.funder_name}` : "New grant opportunity",
          createdAt: item.created_at,
          path: "/grants",
        })),
        ...grantApplications.map((item: any) => ({
          id: `grant_application-${item.id}`,
          type: "grant_application" as const,
          title: "Grant application created",
          description: [item.stage, item.status].filter(Boolean).join(" • ") || "New grant application",
          createdAt: item.created_at,
          path: "/grants",
        })),
        ...ngos.map((item: any) => ({
          id: `ngo-${item.id}`,
          type: "ngo" as const,
          title: formatEntityName(item.common_name, item.legal_name),
          description: item.status ? `NGO status: ${item.status}` : "NGO record updated",
          createdAt: item.updated_at || item.created_at,
          path: `/ngo/${item.id}`,
        })),
        ...auditLogs.map((item: any) => ({
          id: `audit-${item.id}`,
          type: "audit" as const,
          title: `${item.entity_type || "Record"} ${item.action_type || "updated"}`,
          description: item.entity_id ? `Record ID: ${item.entity_id}` : "Audit activity",
          createdAt: item.created_at,
          path: "/audit",
        })),
      ];

      return activity
        .filter((item) => Boolean(item.createdAt))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 15);
    },
  });
};
