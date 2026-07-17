import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SystemUsageMonthlyReport {
  id: string;
  provider: "google_drive" | "confluence" | "slack" | "trello";
  reporting_month: string;
  status: "pending" | "imported" | "analyzed" | "reviewed" | "exception";
  metrics: Record<string, unknown>;
  findings: unknown[];
  recommendations: unknown[];
  source_url: string | null;
  imported_at: string | null;
  analyzed_at: string | null;
  reviewed_at: string | null;
}

interface UsageAuditQueryResult {
  data: unknown;
  error: Error | null;
}

interface UsageAuditQuery extends PromiseLike<UsageAuditQueryResult> {
  select: (columns: string) => UsageAuditQuery;
  eq: (column: string, value: string) => UsageAuditQuery;
  order: (column: string) => UsageAuditQuery;
}

interface UsageAuditClient {
  from: (table: "system_usage_monthly_reports") => UsageAuditQuery;
}

export function useSystemUsageAudits(reportingMonth?: string) {
  return useQuery({
    queryKey: ["system-usage-monthly-reports", reportingMonth || "current"],
    enabled: !!supabase,
    queryFn: async () => {
      const month = reportingMonth || new Date().toISOString().slice(0, 7) + "-01";
      const client = supabase as unknown as UsageAuditClient;
      const { data, error } = await client
        .from("system_usage_monthly_reports")
        .select("*")
        .eq("reporting_month", month)
        .order("provider");
      if (error) throw error;
      return (data || []) as SystemUsageMonthlyReport[];
    },
  });
}
