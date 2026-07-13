import { useQuery } from "@tanstack/react-query";
import { ensureSupabase } from "@/integrations/supabase/client";

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
  queryFn: async (): Promise<FinanceHubSnapshot> => {
    const supabase = ensureSupabase();
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
      supabase.from("work_items").select("id", { count: "exact", head: true }).eq("module", "finance").is("archived_at", null),
      supabase.from("finance_journal_entries" as never).select("id", { count: "exact", head: true }).eq("status" as never, "draft" as never),
      supabase.from("finance_bank_accounts" as never).select("id", { count: "exact", head: true }).eq("is_active" as never, true as never),
      supabase.from("finance_bills" as never).select("id, total_amount, amount_paid, due_date").in("status" as never, ["approved", "partially_paid"] as never),
      supabase.from("finance_bank_reconciliations" as never).select("bank_account_id, status"),
      supabase.from("finance_journal_entries" as never).select("id").eq("status" as never, "posted" as never).limit(1),
      supabase.from("finance_expense_requests" as never).select("id", { count: "exact", head: true }).eq("status" as never, "submitted" as never),
      supabase.from("purchase_requests").select("id", { count: "exact", head: true }).eq("status", "pending_approval"),
      supabase.from("finance_budgets" as never).select("id", { count: "exact", head: true }).eq("status" as never, "pending_approval" as never),
      supabase.from("finance_workflow_events" as never).select("id", { count: "exact", head: true }).eq("notification_status" as never, "queued" as never),
    ]);

    let missingReceipts = 0;
    if (postedEntries?.length) {
      const { data: entries } = await supabase.from("finance_journal_entries" as never).select("id").eq("status" as never, "posted" as never).limit(50);
      if (entries?.length) {
        const checks = await Promise.all(
          entries.map(async (e: { id: string }) => {
            const { data } = await supabase.rpc("finance_journal_entry_has_receipt" as never, { _entry_id: e.id } as never);
            return Boolean(data);
          })
        );
        missingReceipts = checks.filter((h) => !h).length;
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

    const { count: coaCount } = await supabase.from("finance_accounts" as never).select("id", { count: "exact", head: true });
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
  },
});
