import { useQuery } from "@tanstack/react-query";
import { ensureSupabase } from "@/integrations/supabase/client";
import { createDashboardRequestScope } from "@/lib/dashboardRequest";

export interface FinanceHubSnapshot {
  openWorkItems: number;
  missingReceipts: number;
  billsDue: number;
  unreconciledBanks: number;
  cashAccounts: number;
  draftEntries: number;
  pendingExpenseRequests: number;
  pendingPurchaseRequests: number;
  pendingBudgetApprovals: number;
  queuedNotifications: number;
  dataReadiness: "ready" | "partial" | "setup";
}

export const useFinanceHubSnapshot = () => useQuery({
  queryKey: ["finance-hub-snapshot"],
  queryFn: async ({ signal }): Promise<FinanceHubSnapshot> => {
    const supabase = ensureSupabase();
    const request = createDashboardRequestScope(signal);

    try {
    const [
      { count: openWorkItems },
      { count: draftEntries },
      { count: cashAccounts },
      { data: openBills },
      { data: recons },
      { data: postedEntries },
      { count: pendingExpenseRequests },
      { count: pendingPurchaseRequests },
      { count: pendingBudgetApprovals },
      { count: queuedNotifications },
    ] = await Promise.all([
      supabase.from("work_items").select("id", { count: "exact", head: true }).eq("module", "finance").is("archived_at", null).abortSignal(request.signal),
      supabase.from("finance_journal_entries" as never).select("id", { count: "exact", head: true }).eq("status" as never, "draft" as never).abortSignal(request.signal),
      supabase.from("finance_bank_accounts" as never).select("id", { count: "exact", head: true }).eq("is_active" as never, true as never).abortSignal(request.signal),
      supabase.from("finance_bills" as never).select("id, total_amount, amount_paid, due_date").in("status" as never, ["approved", "partially_paid"] as never).abortSignal(request.signal),
      supabase.from("finance_bank_reconciliations" as never).select("bank_account_id, status").abortSignal(request.signal),
      supabase.from("finance_journal_entries" as never).select("id").eq("status" as never, "posted" as never).limit(1).abortSignal(request.signal),
      supabase.from("finance_expense_requests" as never).select("id", { count: "exact", head: true }).eq("status" as never, "submitted" as never).abortSignal(request.signal),
      supabase.from("purchase_requests").select("id", { count: "exact", head: true }).eq("status", "pending_approval").abortSignal(request.signal),
      supabase.from("finance_budgets" as never).select("id", { count: "exact", head: true }).eq("status" as never, "pending_approval" as never).abortSignal(request.signal),
      supabase.from("finance_workflow_events" as never).select("id", { count: "exact", head: true }).eq("notification_status" as never, "queued" as never).abortSignal(request.signal),
    ]);

    if (request.signal.aborted) throw new DOMException("Finance dashboard request timed out", "AbortError");

    let missingReceipts = 0;
    if (postedEntries?.length) {
      const { data: entries, error: entriesError } = await supabase
        .from("finance_journal_entries" as never)
        .select("id")
        .eq("status" as never, "posted" as never)
        .limit(50)
        .abortSignal(request.signal);
      if (entriesError) throw entriesError;

      if (entries?.length) {
        const entryIds = (entries as { id: string }[]).map((entry) => entry.id);
        const [directLinksResult, linesResult] = await Promise.all([
          supabase
            .from("finance_document_links" as never)
            .select("entity_id")
            .eq("entity_type" as never, "journal_entry" as never)
            .in("entity_id" as never, entryIds as never)
            .abortSignal(request.signal),
          supabase
            .from("finance_journal_lines" as never)
            .select("id, journal_entry_id, document_id")
            .in("journal_entry_id" as never, entryIds as never)
            .abortSignal(request.signal),
        ]);

        if (directLinksResult.error) throw directLinksResult.error;
        if (linesResult.error) throw linesResult.error;

        const lines = (linesResult.data ?? []) as unknown as Array<{
          id: string;
          journal_entry_id: string;
          document_id: string | null;
        }>;
        const lineIds = lines.map((line) => line.id);
        const lineLinksResult = lineIds.length
          ? await supabase
              .from("finance_document_links" as never)
              .select("entity_id")
              .eq("entity_type" as never, "journal_line" as never)
              .in("entity_id" as never, lineIds as never)
              .abortSignal(request.signal)
          : { data: [], error: null };

        if (lineLinksResult.error) throw lineLinksResult.error;

        const supportedEntries = new Set(
          ((directLinksResult.data ?? []) as unknown as { entity_id: string }[]).map((link) => link.entity_id),
        );
        const linkedLineIds = new Set(
          ((lineLinksResult.data ?? []) as unknown as { entity_id: string }[]).map((link) => link.entity_id),
        );
        lines.forEach((line) => {
          if (line.document_id || linkedLineIds.has(line.id)) supportedEntries.add(line.journal_entry_id);
        });

        missingReceipts = entryIds.filter((entryId) => !supportedEntries.has(entryId)).length;
      }
    }

    const today = new Date();
    const billsDue = (openBills || []).filter((b: { due_date: string | null; total_amount: number; amount_paid: number }) => {
      const bal = Number(b.total_amount) - Number(b.amount_paid);
      return bal > 0 && b.due_date && new Date(b.due_date) <= today;
    }).length;

    const activeBanks = cashAccounts ?? 0;
    const finalizedBankIds = new Set((recons || []).filter((r: { status: string }) => r.status === "finalized").map((r: { bank_account_id: string }) => r.bank_account_id));
    const unreconciledBanks = Math.max(0, activeBanks - finalizedBankIds.size);

    const { count: coaCount, error: coaError } = await supabase
      .from("finance_accounts" as never)
      .select("id", { count: "exact", head: true })
      .abortSignal(request.signal);
    if (coaError) throw coaError;
    const dataReadiness = (coaCount ?? 0) > 0 && (postedEntries?.length ?? 0) > 0 ? "ready" : (coaCount ?? 0) > 0 ? "partial" : "setup";

    return {
      openWorkItems: openWorkItems ?? 0,
      missingReceipts,
      billsDue,
      unreconciledBanks,
      cashAccounts: activeBanks,
      draftEntries: draftEntries ?? 0,
      pendingExpenseRequests: pendingExpenseRequests ?? 0,
      pendingPurchaseRequests: pendingPurchaseRequests ?? 0,
      pendingBudgetApprovals: pendingBudgetApprovals ?? 0,
      queuedNotifications: queuedNotifications ?? 0,
      dataReadiness,
    };
    } finally {
      request.cleanup();
    }
  },
});
