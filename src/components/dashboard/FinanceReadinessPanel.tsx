import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DollarSign, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFinanceHubSnapshot } from "@/hooks/useFinanceHubSnapshot";
import { ensureSupabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const FINANCE_TABLES = [
  { table: "finance_accounts", label: "Chart of Accounts" },
  { table: "finance_journal_entries", label: "Journal Entries" },
  { table: "finance_bank_accounts", label: "Bank Accounts" },
  { table: "finance_bills", label: "Bills (AP)" },
  { table: "finance_payments", label: "Payments" },
  { table: "finance_deposits", label: "Deposits" },
];

export const FinanceReadinessPanel = () => {
  const navigate = useNavigate();
  const { data: snapshot, isLoading: snapLoading } = useFinanceHubSnapshot();

  const { data: tableHealth = [], isLoading: healthLoading } = useQuery({
    queryKey: ["finance-readiness-tables"],
    queryFn: async () => {
      const supabase = ensureSupabase();
      const results = await Promise.all(
        FINANCE_TABLES.map(async ({ table, label }) => {
          try {
            const { count, error } = await supabase.from(table as never).select("id", { count: "exact", head: true });
            if (error?.message?.includes("does not exist")) return { table, label, status: "missing" as const, count: null };
            if (error) return { table, label, status: "missing" as const, count: null };
            return { table, label, status: (count ?? 0) > 0 ? ("connected" as const) : ("empty" as const), count: count ?? 0 };
          } catch {
            return { table, label, status: "missing" as const, count: null };
          }
        })
      );
      return results;
    },
  });

  const isLoading = snapLoading || healthLoading;
  const nextAction = useMemo(() => {
    if (tableHealth.some((t) => t.status === "missing")) return "Apply finance migrations (Phases 31–41) to your Supabase project.";
    if (tableHealth.find((t) => t.table === "finance_accounts")?.status === "empty") return "Load starter chart of accounts or create GL accounts.";
    if ((snapshot?.draftEntries ?? 0) > 0) return "Review and post draft journal entries.";
    if ((snapshot?.missingReceipts ?? 0) > 0) return "Attach receipts to posted journal entries.";
    if ((snapshot?.billsDue ?? 0) > 0) return "Process bills due in Accounts Payable.";
    if ((snapshot?.unreconciledBanks ?? 0) > 0) return "Complete bank reconciliations.";
    return "Finance ledger is operational. Run reports and monitor fiscal sponsorship funds.";
  }, [tableHealth, snapshot]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" />
          Finance Readiness
        </CardTitle>
        <CardDescription>HPG internal accounting foundation — finance_* tables, not legacy NGO ledger.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tableHealth.map((item) => (
                <div key={item.table} className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <Badge variant={item.status === "connected" ? "default" : item.status === "empty" ? "secondary" : "destructive"}>
                      {item.status === "connected" ? "Live" : item.status === "empty" ? "Empty" : "Missing"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{item.count === null ? "—" : `${item.count}`}</span>
                  </div>
                </div>
              ))}
            </div>
            {snapshot && (
              <div className="grid gap-2 sm:grid-cols-4 text-sm">
                <div className="rounded border p-2"><span className="text-muted-foreground">AP due</span><p className="font-medium">{snapshot.billsDue}</p></div>
                <div className="rounded border p-2"><span className="text-muted-foreground">Missing receipts</span><p className="font-medium">{snapshot.missingReceipts}</p></div>
                <div className="rounded border p-2"><span className="text-muted-foreground">Finance tasks</span><p className="font-medium">{snapshot.openWorkItems}</p></div>
                <div className="rounded border p-2"><span className="text-muted-foreground">Readiness</span><p className="font-medium capitalize">{snapshot.dataReadiness}</p></div>
              </div>
            )}
            <p className="text-sm text-muted-foreground">{nextAction}</p>
            <Button variant="outline" size="sm" onClick={() => navigate("/financial-hub")}>Open Finance Hub</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
