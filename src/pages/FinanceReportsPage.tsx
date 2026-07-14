import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Download, Printer } from "lucide-react";
import {
  exportToCsv, useFinanceApAging, useFinanceBalanceSheet, useFinanceFundBalanceSummary,
  useFinanceGeneralLedger, useFinanceMissingReceiptsReport, useFinanceStatementOfActivity, useFinanceTrialBalance,
} from "@/hooks/useFinanceReports";
import { logFinanceExport, useFinanceStatementOfCashFlows, useFinanceTrialBalanceValidation, useFinanceStatementOfFinancialPosition, useFinanceStatementOfActivities, useSaveFinanceReportSnapshot } from "@/hooks/useFinanceCompliance";
import { useFinanceArAging } from "@/hooks/useFinanceInvoices";
import { useFinanceAccounts } from "@/hooks/useFinanceAccounts";
import { useFinanceDeposits } from "@/hooks/useFinanceDeposits";
import { FINANCE_DEPOSIT_SOURCE_LABELS } from "@/types/financeAccounting";
import { toast } from "sonner";
import { useWorkspaceNgo } from "@/hooks/useWorkspaceNgo";

const fmt = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });
const yearStart = `${new Date().getFullYear()}-01-01`;
const today = new Date().toISOString().slice(0, 10);

const FinanceReportsPage = () => {
  const { selectedNgo, selectedNgoId } = useWorkspaceNgo();
  const [startDate, setStartDate] = useState(yearStart);
  const [endDate, setEndDate] = useState(today);
  const [includeDrafts, setIncludeDrafts] = useState(false);
  const [glAccountId, setGlAccountId] = useState<string>("");
  const [activeReport, setActiveReport] = useState("trial-balance");

  const filters = useMemo(
    () => ({ startDate, endDate, includeDrafts, ngoId: selectedNgoId }),
    [endDate, includeDrafts, selectedNgoId, startDate],
  );
  const { data: trialBalance = [], isLoading: tbLoading } = useFinanceTrialBalance(filters);
  const { data: pl } = useFinanceStatementOfActivity(filters);
  const { data: bs } = useFinanceBalanceSheet(filters);
  const { data: fundBalance = [] } = useFinanceFundBalanceSummary(filters);
  const { data: glLines = [] } = useFinanceGeneralLedger({ ...filters, accountId: glAccountId || undefined });
  const { data: apAging = [] } = useFinanceApAging(selectedNgoId);
  const { data: missingReceipts = [] } = useFinanceMissingReceiptsReport(selectedNgoId);
  const { data: deposits = [] } = useFinanceDeposits(selectedNgoId);
  const { data: accounts = [] } = useFinanceAccounts();
  const { data: cashFlow } = useFinanceStatementOfCashFlows(startDate, endDate, selectedNgoId);
  const { data: tbValidation } = useFinanceTrialBalanceValidation(startDate, endDate, selectedNgoId);
  const { data: sofp } = useFinanceStatementOfFinancialPosition(endDate, selectedNgoId);
  const { data: soa } = useFinanceStatementOfActivities(startDate, endDate, selectedNgoId);
  const { data: arAging = [] } = useFinanceArAging(selectedNgoId);
  const saveSnapshot = useSaveFinanceReportSnapshot();

  const postedDeposits = deposits.filter((d) => d.status === "posted");

  const exportWithAudit = async (
    reportType: string,
    filename: string,
    headers: string[],
    rows: (string | number)[][],
  ) => {
    try {
      await logFinanceExport(reportType, { ...filters, accountId: glAccountId || null });
      exportToCsv(filename, headers, rows);
    } catch (error) {
      toast.error("Export canceled because the audit event could not be recorded", {
        description: error instanceof Error ? error.message : "Unknown export error",
      });
    }
  };

  const printWithAudit = async () => {
    try {
      await logFinanceExport(`${activeReport.replace(/-/g, "_")}_print`, { ...filters, accountId: glAccountId || null });
      window.print();
    } catch (error) {
      toast.error("Print canceled because the audit event could not be recorded", {
        description: error instanceof Error ? error.message : "Unknown export error",
      });
    }
  };

  return (
    <MainLayout
      title="Financial Reports"
      subtitle={`Official posted-ledger reports for ${selectedNgo?.common_name || selectedNgo?.legal_name || "All HPG"}`}
    >
      <Card className="mb-6">
        <CardContent className="pt-6 flex flex-wrap gap-4 items-end">
          <div className="space-y-2"><Label>Start date</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" /></div>
          <div className="space-y-2"><Label>End date</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" /></div>
          <div className="flex items-center gap-2"><Switch checked={includeDrafts} onCheckedChange={setIncludeDrafts} /><Label>Include drafts</Label></div>
          {tbValidation && (
            <span className={`text-sm ${tbValidation.is_balanced ? "text-green-600" : "text-destructive"}`}>
              TB {tbValidation.is_balanced ? "balanced" : "unbalanced"}
            </span>
          )}
          <Button variant="outline" onClick={printWithAudit}>
            <Printer className="h-4 w-4 mr-1" />Print / Save PDF
          </Button>
        </CardContent>
      </Card>

      <Tabs value={activeReport} onValueChange={setActiveReport}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="trial-balance">Trial Balance</TabsTrigger>
          <TabsTrigger value="pl">Statement of Activity</TabsTrigger>
          <TabsTrigger value="bs">Statement of Financial Position</TabsTrigger>
          <TabsTrigger value="cash-flow">Statement of Cash Flows</TabsTrigger>
          <TabsTrigger value="gl">General Ledger</TabsTrigger>
          <TabsTrigger value="funds">Fund Balance</TabsTrigger>
          <TabsTrigger value="ap">AP Aging</TabsTrigger>
          <TabsTrigger value="ar">AR Aging</TabsTrigger>
          <TabsTrigger value="deposits">Deposits</TabsTrigger>
          <TabsTrigger value="receipts">Missing Receipts</TabsTrigger>
        </TabsList>

        <TabsContent value="trial-balance" className="mt-4">
          <ReportCard title="Trial Balance" loading={tbLoading} onExport={() => exportWithAudit("trial_balance", "trial-balance.csv", ["Code", "Account", "Debit", "Credit", "Balance"],
            trialBalance.map((r) => [r.account?.code ?? "", r.account?.name ?? "", r.debit, r.credit, r.balance]))}>
            <table className="w-full text-sm"><thead><tr className="border-b text-muted-foreground"><th className="p-2 text-left">Account</th><th className="p-2 text-right">Debit</th><th className="p-2 text-right">Credit</th><th className="p-2 text-right">Balance</th></tr></thead>
              <tbody>{trialBalance.map((r, i) => (
                <tr key={i} className="border-b"><td className="p-2">{r.account?.code} — {r.account?.name}</td>
                  <td className="p-2 text-right">{fmt(r.debit)}</td><td className="p-2 text-right">{fmt(r.credit)}</td><td className="p-2 text-right">{fmt(r.balance)}</td></tr>
              ))}</tbody></table>
          </ReportCard>
        </TabsContent>

        <TabsContent value="pl" className="mt-4">
          <ReportCard title="Statement of Activities" onExport={() => exportWithAudit("statement_of_activities", "statement-of-activity.csv", ["Metric", "Amount"],
            soa ? [
              ["Revenue without restrictions", Number(soa.revenue_without_restrictions)],
              ["Revenue with restrictions", Number(soa.revenue_with_restrictions)],
              ["Program expenses", Number(soa.program_expenses)],
              ["Management & general", Number(soa.management_general_expenses)],
              ["Fundraising", Number(soa.fundraising_expenses)],
              ["Change in net assets", Number(soa.change_in_net_assets)],
            ] : [])}
            extraAction={soa ? () => saveSnapshot.mutate({ reportType: "statement_of_activities", label: `SOA ${startDate}–${endDate}`, filters: { startDate, endDate }, data: soa as Record<string, unknown> }) : undefined}
          >
            {soa ? (
              <div className="space-y-2 text-sm">
                {[
                  ["Revenue without donor restrictions", soa.revenue_without_restrictions],
                  ["Revenue with donor restrictions", soa.revenue_with_restrictions],
                  ["Net assets released", soa.net_assets_released],
                  ["Program expenses", soa.program_expenses],
                  ["Management & general", soa.management_general_expenses],
                  ["Fundraising expenses", soa.fundraising_expenses],
                  ["Change in net assets", soa.change_in_net_assets],
                ].map(([label, val]) => (
                  <div key={String(label)} className="flex justify-between"><span>{label}</span><span>{fmt(Number(val))}</span></div>
                ))}
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                <div><h4 className="font-medium mb-2">Revenue</h4>{pl?.revenue.map((r, i) => (
                  <div key={i} className="flex justify-between text-sm py-1"><span>{(r.account as { name: string }).name}</span><span>{fmt(r.amount)}</span></div>
                ))}</div>
                <div><h4 className="font-medium mb-2">Expenses</h4>{pl?.expense.map((e, i) => (
                  <div key={i} className="flex justify-between text-sm py-1"><span>{(e.account as { name: string }).name}</span><span>{fmt(e.amount)}</span></div>
                ))}</div>
              </div>
            )}
          </ReportCard>
        </TabsContent>

        <TabsContent value="bs" className="mt-4">
          <ReportCard title="Statement of Financial Position" onExport={() => exportWithAudit(
            "statement_of_financial_position",
            "statement-of-financial-position.csv",
            ["Metric", "Amount"],
            sofp ? [
              ["Net assets without donor restrictions", Number(sofp.net_assets_without_restrictions)],
              ["Net assets with donor restrictions", Number(sofp.net_assets_with_restrictions)],
              ["Total net assets", Number(sofp.total_net_assets)],
            ] : Object.entries(bs ?? {}).flatMap(([section, rows]) => rows.map((row) => [
              `${section}: ${(row.account as { name: string }).name}`,
              row.balance,
            ])),
          )}>
            {sofp ? (
              <div className="space-y-4 text-sm">
                <div><h4 className="font-medium">Net assets without donor restrictions</h4><p>{fmt(Number(sofp.net_assets_without_restrictions))}</p></div>
                <div><h4 className="font-medium">Net assets with donor restrictions</h4><p>{fmt(Number(sofp.net_assets_with_restrictions))}</p></div>
                <div><h4 className="font-medium">Total net assets</h4><p className="font-semibold">{fmt(Number(sofp.total_net_assets))}</p></div>
              </div>
            ) : (
              (["asset", "liability", "equity"] as const).map((section) => (
                <div key={section} className="mb-4"><h4 className="font-medium capitalize mb-2">{section}s</h4>
                  {bs?.[section].map((r, i) => (
                    <div key={i} className="flex justify-between text-sm py-1"><span>{(r.account as { name: string }).name}</span><span>{fmt(r.balance)}</span></div>
                  ))}</div>
              ))
            )}
          </ReportCard>
        </TabsContent>

        <TabsContent value="cash-flow" className="mt-4">
          <ReportCard title="Statement of Cash Flows" onExport={() => exportWithAudit(
            "statement_of_cash_flows",
            "statement-of-cash-flows.csv",
            ["Metric", "Amount"],
            cashFlow ? Object.entries(cashFlow).filter(([key]) => !key.includes("date")).map(([key, value]) => [key.replace(/_/g, " "), Number(value)]) : [],
          )}>
            {cashFlow && (
              <div className="space-y-2 text-sm">
                {Object.entries(cashFlow).filter(([k]) => !k.includes("date")).map(([k, v]) => (
                  <div key={k} className="flex justify-between"><span className="capitalize">{k.replace(/_/g, " ")}</span><span>{fmt(Number(v))}</span></div>
                ))}
              </div>
            )}
          </ReportCard>
        </TabsContent>

        <TabsContent value="gl" className="mt-4">
          <ReportCard title="General Ledger" onExport={glAccountId ? () => exportWithAudit(
            "general_ledger",
            "general-ledger.csv",
            ["Date", "Entry", "Debit", "Credit", "Memo"],
            glLines.map((line) => [line.entry?.entry_date ?? "", line.entry?.entry_number ?? "", Number(line.debit), Number(line.credit), line.memo ?? ""]),
          ) : undefined}>
            <div className="mb-4 flex gap-2 flex-wrap">{accounts.map((a) => (
              <Button key={a.id} size="sm" variant={glAccountId === a.id ? "default" : "outline"} onClick={() => setGlAccountId(a.id)}>{a.code}</Button>
            ))}</div>
            {!glAccountId ? <p className="text-sm text-muted-foreground">Select an account.</p> : (
              <table className="w-full text-sm"><thead><tr className="border-b text-muted-foreground"><th className="p-2">Date</th><th className="p-2">Entry</th><th className="p-2">Debit</th><th className="p-2">Credit</th></tr></thead>
                <tbody>{glLines.map((l, i) => (
                  <tr key={i} className="border-b"><td className="p-2">{l.entry?.entry_date}</td><td className="p-2 font-mono">{l.entry?.entry_number}</td>
                    <td className="p-2">{Number(l.debit) > 0 ? fmt(Number(l.debit)) : ""}</td><td className="p-2">{Number(l.credit) > 0 ? fmt(Number(l.credit)) : ""}</td></tr>
                ))}</tbody></table>
            )}
          </ReportCard>
        </TabsContent>

        <TabsContent value="funds" className="mt-4">
          <ReportCard title="Fund Balance Summary" onExport={() => exportWithAudit(
            "fund_balance_summary",
            "fund-balance-summary.csv",
            ["Fund", "Balance"],
            fundBalance.map((fund) => [(fund.fund as { name: string })?.name ?? "Unassigned", fund.balance]),
          )}>
            <table className="w-full text-sm"><thead><tr className="border-b"><th className="p-2 text-left">Fund</th><th className="p-2 text-right">Balance</th></tr></thead>
              <tbody>{fundBalance.map((f, i) => (
                <tr key={i} className="border-b"><td className="p-2">{(f.fund as { name: string })?.name ?? "Unassigned"}</td><td className="p-2 text-right">{fmt(f.balance)}</td></tr>
              ))}</tbody></table>
          </ReportCard>
        </TabsContent>

        <TabsContent value="ap" className="mt-4">
          <ReportCard title="AP Aging" onExport={() => exportWithAudit(
            "accounts_payable_aging",
            "accounts-payable-aging.csv",
            ["Bill", "Due date", "Balance", "Aging bucket"],
            apAging.map((row) => [row.bill_number, row.due_date ?? "", row.balance, row.bucket]),
          )}>
            <table className="w-full text-sm"><thead><tr className="border-b"><th className="p-2">Bill</th><th className="p-2">Due</th><th className="p-2">Balance</th><th className="p-2">Bucket</th></tr></thead>
              <tbody>{apAging.map((r, i) => (
                <tr key={i} className="border-b"><td className="p-2 font-mono">{r.bill_number}</td><td className="p-2">{r.due_date || "—"}</td>
                  <td className="p-2">{fmt(r.balance)}</td><td className="p-2">{r.bucket}</td></tr>
              ))}</tbody></table>
          </ReportCard>
        </TabsContent>

        <TabsContent value="ar" className="mt-4">
          <ReportCard title="AR Aging" onExport={() => exportWithAudit(
            "accounts_receivable_aging",
            "accounts-receivable-aging.csv",
            ["Invoice", "Due date", "Balance", "Aging bucket"],
            arAging.map((row) => [row.invoice_number, row.due_date ?? "", Number(row.balance), row.bucket]),
          )}>
            <table className="w-full text-sm"><thead><tr className="border-b"><th className="p-2">Invoice</th><th className="p-2">Due</th><th className="p-2">Balance</th><th className="p-2">Bucket</th></tr></thead>
              <tbody>{arAging.map((r, i) => (
                <tr key={i} className="border-b"><td className="p-2 font-mono">{r.invoice_number}</td><td className="p-2">{r.due_date || "—"}</td>
                  <td className="p-2">{fmt(r.balance)}</td><td className="p-2">{r.bucket}</td></tr>
              ))}</tbody></table>
          </ReportCard>
        </TabsContent>

        <TabsContent value="deposits" className="mt-4">
          <ReportCard title="Deposit / Revenue Summary" onExport={() => exportWithAudit(
            "deposit_revenue_summary",
            "deposit-revenue-summary.csv",
            ["Number", "Date", "Source", "Amount"],
            postedDeposits.map((deposit) => [deposit.deposit_number, deposit.deposit_date, FINANCE_DEPOSIT_SOURCE_LABELS[deposit.source_type], deposit.total_amount]),
          )}>
            <table className="w-full text-sm"><thead><tr className="border-b"><th className="p-2">Number</th><th className="p-2">Date</th><th className="p-2">Source</th><th className="p-2">Amount</th></tr></thead>
              <tbody>{postedDeposits.map((d) => (
                <tr key={d.id} className="border-b"><td className="p-2 font-mono">{d.deposit_number}</td><td className="p-2">{d.deposit_date}</td>
                  <td className="p-2">{FINANCE_DEPOSIT_SOURCE_LABELS[d.source_type]}</td><td className="p-2">{fmt(d.total_amount)}</td></tr>
              ))}</tbody></table>
          </ReportCard>
        </TabsContent>

        <TabsContent value="receipts" className="mt-4">
          <ReportCard title="Missing Receipts" onExport={() => exportWithAudit(
            "missing_receipts",
            "missing-receipts.csv",
            ["Entry", "Date", "Memo"],
            missingReceipts.map((entry) => [entry.entry_number, entry.entry_date, entry.memo ?? ""]),
          )}>
            <table className="w-full text-sm"><thead><tr className="border-b"><th className="p-2">Entry</th><th className="p-2">Date</th><th className="p-2">Memo</th></tr></thead>
              <tbody>{missingReceipts.map((e) => (
                <tr key={e.id} className="border-b"><td className="p-2 font-mono">{e.entry_number}</td><td className="p-2">{e.entry_date}</td><td className="p-2">{e.memo || "—"}</td></tr>
              ))}</tbody></table>
          </ReportCard>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
};

function ReportCard({ title, children, loading, onExport, extraAction }: {
  title: string; children: React.ReactNode; loading?: boolean; onExport?: () => void; extraAction?: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        <div className="flex gap-2">
          {extraAction && <Button variant="outline" size="sm" onClick={extraAction}>Save snapshot</Button>}
          {onExport && <Button variant="outline" size="sm" onClick={onExport}><Download className="h-4 w-4 mr-1" />CSV</Button>}
        </div>
      </CardHeader>
      <CardContent>{loading ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : children}</CardContent>
    </Card>
  );
}

export default FinanceReportsPage;
