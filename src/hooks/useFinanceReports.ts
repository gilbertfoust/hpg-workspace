import { useQuery } from "@tanstack/react-query";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";

export type FinanceReportFilters = {
  startDate: string; endDate: string; fundId?: string | null; ngoId?: string | null;
  departmentId?: string | null; accountId?: string | null; includeDrafts?: boolean;
};

const ensureSupabase = () => { if (!supabase) throw getSupabaseNotConfiguredError(); };

async function fetchPostedLines(filters: FinanceReportFilters) {
  ensureSupabase();
  let entryQuery = supabase.from("finance_journal_entries" as never).select("id, entry_date, entry_number, memo, status")
    .gte("entry_date" as never, filters.startDate).lte("entry_date" as never, filters.endDate);
  if (!filters.includeDrafts) entryQuery = entryQuery.eq("status" as never, "posted" as never);
  const { data: entries, error } = await entryQuery;
  if (error) throw error;
  if (!entries?.length) return { entries: [], lines: [], accounts: [] };

  const entryIds = entries.map((e: { id: string }) => e.id);
  let lineQuery = supabase.from("finance_journal_lines" as never).select("*").in("journal_entry_id" as never, entryIds as never);
  if (filters.fundId) lineQuery = lineQuery.eq("fund_id" as never, filters.fundId as never);
  if (filters.ngoId) lineQuery = lineQuery.eq("ngo_id" as never, filters.ngoId as never);
  if (filters.departmentId) lineQuery = lineQuery.eq("department_id" as never, filters.departmentId as never);
  if (filters.accountId) lineQuery = lineQuery.eq("account_id" as never, filters.accountId as never);
  const { data: lines, error: le } = await lineQuery;
  if (le) throw le;

  const accountIds = [...new Set((lines || []).map((l: { account_id: string }) => l.account_id))];
  const { data: accounts } = accountIds.length
    ? await supabase.from("finance_accounts" as never).select("id, code, name, account_type, normal_balance").in("id" as never, accountIds as never)
    : { data: [] };

  return { entries: entries || [], lines: lines || [], accounts: accounts || [] };
}

export const useFinanceTrialBalance = (filters: FinanceReportFilters) => useQuery({
  queryKey: ["finance-report-trial-balance", filters],
  enabled: !!supabase,
  queryFn: async () => {
    const { lines, accounts } = await fetchPostedLines(filters);
    const acctMap = new Map((accounts as { id: string; code: string; name: string }[]).map((a) => [a.id, a]));
    const totals = new Map<string, { debit: number; credit: number }>();
    (lines as { account_id: string; debit: number; credit: number }[]).forEach((l) => {
      const t = totals.get(l.account_id) || { debit: 0, credit: 0 };
      t.debit += Number(l.debit); t.credit += Number(l.credit); totals.set(l.account_id, t);
    });
    return [...totals.entries()].map(([accountId, t]) => ({
      account: acctMap.get(accountId), debit: t.debit, credit: t.credit, balance: t.debit - t.credit,
    })).sort((a, b) => (a.account?.code || "").localeCompare(b.account?.code || ""));
  },
});

export const useFinanceStatementOfActivity = (filters: FinanceReportFilters) => useQuery({
  queryKey: ["finance-report-pl", filters],
  enabled: !!supabase,
  queryFn: async () => {
    const { lines, accounts } = await fetchPostedLines(filters);
    const revenue: { account: unknown; amount: number }[] = [];
    const expense: { account: unknown; amount: number }[] = [];
    const acctMap = new Map((accounts as { id: string; account_type: string; code: string; name: string }[]).map((a) => [a.id, a]));
    const byAcct = new Map<string, number>();
    (lines as { account_id: string; debit: number; credit: number }[]).forEach((l) => {
      byAcct.set(l.account_id, (byAcct.get(l.account_id) || 0) + Number(l.credit) - Number(l.debit));
    });
    byAcct.forEach((amount, id) => {
      const acct = acctMap.get(id);
      if (!acct) return;
      if (acct.account_type === "revenue") revenue.push({ account: acct, amount });
      if (acct.account_type === "expense") expense.push({ account: acct, amount: -amount });
    });
    const totalRevenue = revenue.reduce((s, r) => s + r.amount, 0);
    const totalExpense = expense.reduce((s, e) => s + e.amount, 0);
    return { revenue, expense, netIncome: totalRevenue - totalExpense };
  },
});

export const useFinanceBalanceSheet = (filters: FinanceReportFilters) => useQuery({
  queryKey: ["finance-report-bs", filters],
  enabled: !!supabase,
  queryFn: async () => {
    const { lines, accounts } = await fetchPostedLines(filters);
    const acctMap = new Map((accounts as { id: string; account_type: string; code: string; name: string }[]).map((a) => [a.id, a]));
    const sections = { asset: [] as { account: unknown; balance: number }[], liability: [] as { account: unknown; balance: number }[], equity: [] as { account: unknown; balance: number }[] };
    const byAcct = new Map<string, number>();
    (lines as { account_id: string; debit: number; credit: number }[]).forEach((l) => {
      byAcct.set(l.account_id, (byAcct.get(l.account_id) || 0) + Number(l.debit) - Number(l.credit));
    });
    byAcct.forEach((balance, id) => {
      const acct = acctMap.get(id);
      if (!acct) return;
      const section = sections[acct.account_type as keyof typeof sections];
      if (section) section.push({ account: acct, balance });
    });
    return sections;
  },
});

export const useFinanceGeneralLedger = (filters: FinanceReportFilters & { accountId?: string }) => useQuery({
  queryKey: ["finance-report-gl", filters],
  enabled: !!supabase && !!filters.accountId,
  queryFn: async () => {
    const { entries, lines } = await fetchPostedLines(filters);
    const entryMap = new Map((entries as { id: string; entry_date: string; entry_number: string; memo: string }[]).map((e) => [e.id, e]));
    return (lines as { journal_entry_id: string; debit: number; credit: number; memo: string | null }[])
      .filter((l) => !filters.accountId || (l as { account_id: string }).account_id === filters.accountId)
      .map((l) => ({ ...l, entry: entryMap.get(l.journal_entry_id) }))
      .sort((a, b) => (a.entry?.entry_date || "").localeCompare(b.entry?.entry_date || ""));
  },
});

export const useFinanceFundBalanceSummary = (filters: FinanceReportFilters) => useQuery({
  queryKey: ["finance-report-fund-balance", filters],
  enabled: !!supabase,
  queryFn: async () => {
    ensureSupabase();
    const { lines } = await fetchPostedLines(filters);
    const fundIds = [...new Set((lines as { fund_id: string | null }[]).map((l) => l.fund_id).filter(Boolean))] as string[];
    const { data: funds } = fundIds.length ? await supabase.from("finance_funds" as never).select("id, name, fund_type").in("id" as never, fundIds as never) : { data: [] };
    const fundMap = new Map((funds || []).map((f: { id: string; name: string; fund_type: string }) => [f.id, f]));
    const byFund = new Map<string, number>();
    (lines as { fund_id: string | null; debit: number; credit: number }[]).forEach((l) => {
      if (!l.fund_id) return;
      byFund.set(l.fund_id, (byFund.get(l.fund_id) || 0) + Number(l.debit) - Number(l.credit));
    });
    return [...byFund.entries()].map(([fundId, balance]) => ({ fund: fundMap.get(fundId), balance }));
  },
});

export const useFinanceApAging = () => useQuery({
  queryKey: ["finance-report-ap-aging"],
  enabled: !!supabase,
  queryFn: async () => {
    ensureSupabase();
    const { data, error } = await supabase.from("finance_bills" as never).select("bill_number, vendor_id, due_date, total_amount, amount_paid, status")
      .in("status" as never, ["approved", "partially_paid"] as never);
    if (error) throw error;
    const today = new Date();
    return (data || []).map((b: { bill_number: string; due_date: string | null; total_amount: number; amount_paid: number; status: string }) => {
      const balance = Number(b.total_amount) - Number(b.amount_paid);
      const daysPastDue = b.due_date ? Math.floor((today.getTime() - new Date(b.due_date).getTime()) / 86400000) : 0;
      return { ...b, balance, daysPastDue, bucket: daysPastDue <= 0 ? "current" : daysPastDue <= 30 ? "1-30" : daysPastDue <= 60 ? "31-60" : "61+" };
    });
  },
});

export const useFinanceMissingReceiptsReport = () => useQuery({
  queryKey: ["finance-report-missing-receipts"],
  enabled: !!supabase,
  queryFn: async () => {
    ensureSupabase();
    const { data: entries } = await supabase.from("finance_journal_entries" as never).select("id, entry_number, entry_date, memo, status").eq("status" as never, "posted" as never);
    if (!entries?.length) return [];
    const results = await Promise.all(
      (entries as { id: string }[]).map(async (e) => {
        const { data: has } = await supabase.rpc("finance_journal_entry_has_receipt" as never, { _entry_id: e.id } as never);
        return { ...e, has_receipt: Boolean(has) };
      })
    );
    return results.filter((e) => !e.has_receipt);
  },
});

export const exportToCsv = (filename: string, headers: string[], rows: (string | number)[][]) => {
  const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};
