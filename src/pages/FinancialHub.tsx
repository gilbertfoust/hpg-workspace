import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AgentOSFinanceVerificationPanel } from "@/components/ngo/AgentOSFinanceVerificationPanel";
import { useFinanceHubSnapshot } from "@/hooks/useFinanceHubSnapshot";
import { useAgentOSCases } from "@/hooks/useAgentOSCases";
import { useUserRole } from "@/hooks/useUserRole";
import { canReadFinanceLedger } from "@/lib/financePermissions";
import { FinanceUnauthorized } from "@/components/finance/accounting/FinanceUnauthorized";
import {
  DollarSign, Building, FileCheck, ArrowRight, BookOpen, Scale, Receipt, ShieldCheck,
  Bell, BookOpenCheck, ClipboardCheck, Landmark, Paperclip, FileStack, Wallet, TrendingUp, PieChart, Target, Loader2,
} from "lucide-react";

const FinancialHub = () => {
  const navigate = useNavigate();
  const { role } = useUserRole();
  const { data: snapshot, isLoading } = useFinanceHubSnapshot();
  const agentCases = useAgentOSCases({ limit: 100 });

  if (!canReadFinanceLedger(role)) {
    return (
      <MainLayout>
        <div className="p-6 max-w-lg"><FinanceUnauthorized action="access the Finance Hub ledger" /></div>
      </MainLayout>
    );
  }

  const accountingLinks = [
    { label: "Chart of Accounts", path: "/financial-hub/accounting/chart-of-accounts", icon: BookOpen },
    { label: "Journal Entries", path: "/financial-hub/accounting/journal-entries", icon: BookOpenCheck },
    { label: "Bank Accounts", path: "/financial-hub/accounting/bank-accounts", icon: Landmark },
    { label: "Receipts", path: "/financial-hub/accounting/receipts", icon: Paperclip },
    { label: "Accounts Payable", path: "/financial-hub/accounting/accounts-payable", icon: FileStack },
    { label: "Payments", path: "/financial-hub/accounting/payments", icon: Wallet },
    { label: "Deposits", path: "/financial-hub/accounting/deposits", icon: TrendingUp },
    { label: "Reconciliation", path: "/financial-hub/accounting/reconciliation", icon: Scale },
    { label: "Budgets", path: "/financial-hub/accounting/budgets", icon: Target },
    { label: "Fiscal Periods", path: "/financial-hub/accounting/fiscal-periods", icon: ShieldCheck },
    { label: "Opening Balances", path: "/financial-hub/accounting/opening-balances", icon: Scale },
    { label: "Accounts Receivable", path: "/financial-hub/accounting/accounts-receivable", icon: Receipt },
    { label: "Fiscal Sponsorship", path: "/financial-hub/accounting/fiscal-sponsorship", icon: Building },
    { label: "Reports", path: "/financial-hub/accounting/reports", icon: PieChart },
    { label: "Compliance", path: "/financial-hub/accounting/compliance", icon: FileCheck },
  ];

  return (
    <MainLayout>
      <div className="space-y-8 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financial Hub</h1>
          <p className="text-muted-foreground">HPG double-entry accounting, fiscal sponsorship funds, AP, and nonprofit reporting.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4" />Accounting command panel</CardTitle>
            <CardDescription>Live snapshot from finance tables — not legacy NGO ledger placeholders.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : snapshot ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Cash accounts" value={snapshot.cashAccounts} onClick={() => navigate("/financial-hub/accounting/bank-accounts")} />
                <Metric label="Bills due" value={snapshot.billsDue} tone={snapshot.billsDue > 0 ? "warning" : "default"} onClick={() => navigate("/financial-hub/accounting/accounts-payable")} />
                <Metric label="Missing receipts" value={snapshot.missingReceipts} tone={snapshot.missingReceipts > 0 ? "warning" : "default"} onClick={() => navigate("/financial-hub/accounting/receipts")} />
                <Metric label="Unreconciled banks" value={snapshot.unreconciledBanks} tone={snapshot.unreconciledBanks > 0 ? "warning" : "default"} onClick={() => navigate("/financial-hub/accounting/reconciliation")} />
                <Metric label="Open finance tasks" value={snapshot.openWorkItems} onClick={() => navigate("/work-items")} />
                <Metric label="Draft journal entries" value={snapshot.draftEntries} onClick={() => navigate("/financial-hub/accounting/journal-entries")} />
                <Metric label="Pending approvals" value={snapshot.pendingExpenseRequests + snapshot.pendingPurchaseRequests + snapshot.pendingBudgetApprovals} tone={snapshot.pendingExpenseRequests + snapshot.pendingPurchaseRequests + snapshot.pendingBudgetApprovals > 0 ? "warning" : "default"} onClick={() => navigate("/financial-hub/operations")} />
                <Metric label="Queued notifications" value={snapshot.queuedNotifications} tone={snapshot.queuedNotifications > 0 ? "warning" : "default"} onClick={() => navigate("/financial-hub/operations")} />
                <div className="rounded-lg border p-3 sm:col-span-2">
                  <p className="text-xs text-muted-foreground">Data readiness</p>
                  <Badge className="mt-2" variant={snapshot.dataReadiness === "ready" ? "default" : snapshot.dataReadiness === "partial" ? "secondary" : "outline"}>
                    {snapshot.dataReadiness === "ready" ? "Ledger active" : snapshot.dataReadiness === "partial" ? "COA ready — post entries" : "Run migrations & seed COA"}
                  </Badge>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="cursor-pointer border-primary/30 bg-primary/5 hover:border-primary/60 transition-colors" onClick={() => navigate("/financial-hub/operations")}>
          <CardContent className="p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-2"><ClipboardCheck className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="font-semibold">Finance Operations</p>
                <p className="text-sm text-muted-foreground">Expense requests, purchase approvals, budgets, work items, and notification delivery in one queue.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-primary"><Bell className="h-4 w-4" />Open operations <ArrowRight className="h-4 w-4" /></div>
          </CardContent>
        </Card>

        {!agentCases.error && agentCases.data?.runtimeReady && (
          <AgentOSFinanceVerificationPanel cases={agentCases.data.cases} />
        )}

        <div>
          <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">HPG Accounting</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {accountingLinks.map((link) => (
              <Card key={link.path} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate(link.path)}>
                <CardContent className="p-3 flex items-center gap-2">
                  <link.icon className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm font-medium truncate">{link.label}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/controller")}>
            <CardHeader>
              <div className="flex items-center gap-2"><Building className="h-5 w-5 text-primary" /><CardTitle className="text-base">HPG Controller Hub</CardTitle></div>
              <CardDescription>Cross-NGO financial oversight and treasury</CardDescription>
            </CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">Consolidated views, inter-NGO transfers, risk scoring, and treasury management.</p></CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/financial-hub/compliance")}>
            <CardHeader>
              <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /><CardTitle className="text-base">Year-End Compliance</CardTitle></div>
              <CardDescription>Financial statements, Form 990, audit packages</CardDescription>
            </CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">Guided workflows for year-end statements, donor reporting, and audit support.</p></CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
};

function Metric({ label, value, tone = "default", onClick }: { label: string; value: number; tone?: "default" | "warning"; onClick?: () => void }) {
  return (
    <button type="button" className="rounded-lg border p-3 text-left hover:bg-muted/40 transition-colors" onClick={onClick}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${tone === "warning" && value > 0 ? "text-amber-600" : ""}`}>{value}</p>
    </button>
  );
}

export default FinancialHub;
