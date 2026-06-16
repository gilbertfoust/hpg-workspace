import { useQuery } from "@tanstack/react-query";
import { ensureSupabase } from "@/integrations/supabase/client";

export type DataHealthStatus = "connected" | "empty" | "missing";

export type DataHealthItem = {
  table: string;
  label: string;
  area: string;
  status: DataHealthStatus;
  count: number | null;
  message: string;
};

const dashboardTables = [
  { table: "ngos", label: "NGO Portfolio", area: "NGO Coordination" },
  { table: "work_items", label: "Work Items", area: "Operations" },
  { table: "documents", label: "Documents", area: "Documents / Forms" },
  { table: "form_templates", label: "Form Templates", area: "Documents / Forms" },
  { table: "form_submissions", label: "Form Submissions", area: "Documents / Forms" },
  { table: "grant_opportunities", label: "Grant Opportunities", area: "Development / Grants" },
  { table: "grant_applications", label: "Grant Applications", area: "Development / Grants" },
  { table: "audit_log", label: "Audit Log", area: "Compliance" },
  { table: "profiles", label: "User Profiles", area: "Administration" },
  { table: "org_units", label: "Departments", area: "Administration" },
  { table: "transactions", label: "Finance Transactions", area: "Finance" },
  { table: "accounts", label: "Chart of Accounts", area: "Finance" },
  { table: "journal_entries", label: "Journal Entries", area: "Finance" },
  { table: "staff_profiles", label: "Staff Profiles", area: "HR" },
  { table: "applicants", label: "Applicants", area: "HR" },
  { table: "timesheets", label: "Timesheets", area: "HR" },
];

const checkTable = async (supabase: ReturnType<typeof ensureSupabase>, table: string) => {
  try {
    const { count, error } = await (supabase as any)
      .from(table)
      .select("id", { count: "exact", head: true });

    if (error) {
      return {
        status: "missing" as const,
        count: null,
        message: error.message || "Table unavailable",
      };
    }

    const safeCount = count ?? 0;
    return {
      status: safeCount > 0 ? ("connected" as const) : ("empty" as const),
      count: safeCount,
      message: safeCount > 0 ? "Connected with live records" : "Connected, no records yet",
    };
  } catch (error) {
    return {
      status: "missing" as const,
      count: null,
      message: error instanceof Error ? error.message : "Table unavailable",
    };
  }
};

export const useDashboardDataHealth = () => {
  return useQuery({
    queryKey: ["dashboard-data-health"],
    queryFn: async () => {
      const supabase = ensureSupabase();
      const checks = await Promise.all(
        dashboardTables.map(async (config) => {
          const result = await checkTable(supabase, config.table);
          return {
            ...config,
            ...result,
          } satisfies DataHealthItem;
        }),
      );

      const connected = checks.filter((item) => item.status === "connected").length;
      const empty = checks.filter((item) => item.status === "empty").length;
      const missing = checks.filter((item) => item.status === "missing").length;
      const total = checks.length;
      const readiness = Math.round(((connected + empty * 0.5) / total) * 100);

      return {
        connected,
        empty,
        missing,
        total,
        readiness,
        items: checks,
      };
    },
  });
};
