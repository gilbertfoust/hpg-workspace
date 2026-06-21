import { useQuery } from "@tanstack/react-query";
import { ensureSupabase } from "@/integrations/supabase/client";

type SnapshotStatus = "connected" | "building" | "needs_build" | "attention";

export type DashboardModuleSnapshot = {
  id: string;
  title: string;
  description: string;
  status: SnapshotStatus;
  path: string;
  metrics: { label: string; value: string | number; tone?: "default" | "warning" | "danger" | "success" }[];
  note: string;
};

const titleCase = (value: string | null | undefined) => (value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");

const countRows = async (supabase: ReturnType<typeof ensureSupabase>, table: string, configure?: (query: any) => any) => {
  try {
    let query = (supabase as any).from(table).select("id", { count: "exact", head: true });
    if (configure) query = configure(query);
    const { count, error } = await query;
    if (error) return { count: 0, connected: false, error: error.message as string };
    return { count: count ?? 0, connected: true, error: null };
  } catch (error) {
    return { count: 0, connected: false, error: error instanceof Error ? error.message : "Unavailable" };
  }
};

const activeWorkItemStatuses = [
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

export const useDashboardModuleSnapshots = () => {
  return useQuery({
    queryKey: ["dashboard-module-snapshots"],
    queryFn: async (): Promise<DashboardModuleSnapshot[]> => {
      const supabase = ensureSupabase();

      const [
        ngos,
        onboardingNgos,
        outOfComplianceNgos,
        activeWorkItems,
        grantOpportunities,
        grantApplications,
        grantWorkItems,
        documents,
        pendingDocuments,
        formTemplates,
        financeJournalEntries,
        financeAccounts,
        financeWorkItems,
        financeBills,
        financeBankAccounts,
        staffProfiles,
        applicants,
        hrWorkItems,
        complianceWorkItems,
      ] = await Promise.all([
        countRows(supabase, "ngos"),
        countRows(supabase, "ngos", (q) => q.in("status", ["onboarding", "Onboarding", "training", "Training"])),
        countRows(supabase, "ngos", (q) => q.in("status", ["at_risk", "out_of_compliance", "non_compliant", "suspended", "remediation", "At Risk", "Out of Compliance"])),
        countRows(supabase, "work_items", (q) => q.is("archived_at", null).in("status", activeWorkItemStatuses)),
        countRows(supabase, "grant_opportunities"),
        countRows(supabase, "grant_applications"),
        countRows(supabase, "work_items", (q) => q.is("archived_at", null).eq("module", "development")),
        countRows(supabase, "documents"),
        countRows(supabase, "documents", (q) => q.eq("review_status", "Pending")),
        countRows(supabase, "form_templates"),
        countRows(supabase, "finance_journal_entries"),
        countRows(supabase, "finance_accounts"),
        countRows(supabase, "work_items", (q) => q.is("archived_at", null).eq("module", "finance")),
        countRows(supabase, "finance_bills", (q) => q.in("status", ["approved", "partially_paid"])),
        countRows(supabase, "finance_bank_accounts", (q) => q.eq("is_active", true)),
        countRows(supabase, "staff_profiles"),
        countRows(supabase, "applicants"),
        countRows(supabase, "work_items", (q) => q.is("archived_at", null).eq("module", "hr")),
        countRows(supabase, "work_items", (q) => q.is("archived_at", null).in("module", ["legal", "administration", "ngo_coordination"])),
      ]);

      const snapshots: DashboardModuleSnapshot[] = [
        {
          id: "ngo-coordination",
          title: "NGO Coordination",
          description: "Portfolio, onboarding, compliance follow-up, and sponsored NGO support.",
          status: outOfComplianceNgos.count > 0 ? "attention" : ngos.connected ? "connected" : "needs_build",
          path: "/ngos",
          metrics: [
            { label: "Total NGOs", value: ngos.count },
            { label: "Onboarding", value: onboardingNgos.count },
            { label: "Out of Compliance", value: outOfComplianceNgos.count, tone: outOfComplianceNgos.count > 0 ? "danger" : "success" },
          ],
          note: ngos.connected ? "Live NGO portfolio data is connected." : "NGO table unavailable.",
        },
        {
          id: "development-grants",
          title: "Development / Grants",
          description: "Grant opportunities, applications, proposal tasks, and funder pipeline.",
          status: grantOpportunities.connected && grantApplications.connected ? "connected" : "building",
          path: "/grants",
          metrics: [
            { label: "Opportunities", value: grantOpportunities.count },
            { label: "Applications", value: grantApplications.count },
            { label: "Dev Work Items", value: grantWorkItems.count },
          ],
          note: grantOpportunities.connected ? "Grant tracker data is live." : "Grant tables need review.",
        },
        {
          id: "finance",
          title: "Finance",
          description: "Double-entry ledger, AP, deposits, reconciliation, and finance task load.",
          status: financeAccounts.connected && financeJournalEntries.connected ? "connected" : financeWorkItems.count > 0 ? "building" : "needs_build",
          path: "/financial-hub",
          metrics: [
            { label: "GL Accounts", value: financeAccounts.connected ? financeAccounts.count : "Not connected", tone: financeAccounts.connected ? "default" : "warning" },
            { label: "Journal Entries", value: financeJournalEntries.connected ? financeJournalEntries.count : "Not connected", tone: financeJournalEntries.connected ? "default" : "warning" },
            { label: "Open Bills", value: financeBills.count, tone: financeBills.count > 0 ? "warning" : "default" },
            { label: "Finance Tasks", value: financeWorkItems.count },
          ],
          note: financeAccounts.connected ? "HPG finance_* accounting tables connected." : "Apply finance migrations locally.",
        },
        {
          id: "hr",
          title: "HR",
          description: "Staff records, applicants, onboarding, timesheets, and HR task load.",
          status: staffProfiles.connected || applicants.connected ? "building" : hrWorkItems.count > 0 ? "building" : "needs_build",
          path: "/erp/hr",
          metrics: [
            { label: "Staff", value: staffProfiles.connected ? staffProfiles.count : "Not connected", tone: staffProfiles.connected ? "default" : "warning" },
            { label: "Applicants", value: applicants.connected ? applicants.count : "Not connected", tone: applicants.connected ? "default" : "warning" },
            { label: "HR Tasks", value: hrWorkItems.count },
          ],
          note: staffProfiles.connected ? "HR data is partially connected." : "HR schema still needs production sync.",
        },
        {
          id: "documents-forms",
          title: "Documents / Forms",
          description: "Uploaded records, pending reviews, and form templates.",
          status: pendingDocuments.count > 0 ? "attention" : documents.connected ? "connected" : "building",
          path: "/documents",
          metrics: [
            { label: "Documents", value: documents.count },
            { label: "Pending Review", value: pendingDocuments.count, tone: pendingDocuments.count > 0 ? "warning" : "success" },
            { label: "Form Templates", value: formTemplates.connected ? formTemplates.count : "Not connected", tone: formTemplates.connected ? "default" : "warning" },
          ],
          note: documents.connected ? "Document workflow has live records." : "Document records need review.",
        },
        {
          id: "compliance",
          title: "Compliance",
          description: "Risk, missing evidence, legal/admin follow-up, and compliance workload.",
          status: outOfComplianceNgos.count > 0 || pendingDocuments.count > 0 ? "attention" : "connected",
          path: "/audit",
          metrics: [
            { label: "Compliance Tasks", value: complianceWorkItems.count },
            { label: "Pending Evidence", value: pendingDocuments.count, tone: pendingDocuments.count > 0 ? "warning" : "success" },
            { label: "Out of Compliance", value: outOfComplianceNgos.count, tone: outOfComplianceNgos.count > 0 ? "danger" : "success" },
          ],
          note: "Compliance snapshot is derived from NGO, document, and work item data.",
        },
      ];

      return snapshots;
    },
  });
};
