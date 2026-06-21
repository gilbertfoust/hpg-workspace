import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Download } from "lucide-react";
import {
  exportToCsv, useFinanceApAging, useFinanceBalanceSheet, useFinanceFundBalanceSummary,
  useFinanceGeneralLedger, useFinanceMissingReceiptsReport, useFinanceStatementOfActivity, useFinanceTrialBalance,
} from "@/hooks/useFinanceReports";
import { useFinanceAccounts } from "@/hooks/useFinanceAccounts";
import { useFinanceDeposits } from "@/hooks/useFinanceDeposits";
import { FINANCE_DEPOSIT_SOURCE_LABELS } from "@/types/financeAccounting";

const fmt = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });
const yearStart = `${new Date().getFullYear()}-01-01`;
const today = new Date().toISOString().slice(0, 10);

const FinanceReportsPage = () => {
  const [startDate, setStartDate] = useState(yearStart);
  const [endDate, setEndDate] = useState(today);
  const [includeDrafts, setIncludeDrafts] = useState(false);
  const [glAccountId, setGlAccountId] = useState<string>("");

  const filters = useMemo(() => ({ startDate, endDate, includeDrafts }), [startDate, endDate, includeDrafts]);
  const { data: trialBalance = [], isLoading: tbLoading } = useFinanceTrialBalance(filters);
  const { data: pl } = useFinanceStatementOfActivity(filters);
  const { data: bs } = useFinanceBalanceSheet(filters);
  const { data: fundBalance = [] } = useFinanceFundBalanceSummary(filters);
  const { data: glLines = [] } = useFinanceGeneralLedger({ ...filters, accountId: glAccountId || undefined });
  const { data: apAging = [] } = useFinanceApAging();
  const { data: missingReceipts = [] } = useFinanceMissingReceiptsReport();
  const { data: deposits = [] } = useFinanceDeposits();
  const { data: accounts = [] } = useFinanceAccounts();

  const postedDeposits = deposits.filter((d) => d.status === "posted");

  return (
    <MainLayout title="Financial Reports" subtitle="Official reports use posted journal entries unless drafts toggle is on">
      <Card className="mb-6">
        <CardContent className="pt-6 flex flex-wrap gap-4 items-end">
          <div className="space-y-2"><Label>Start date</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" /></div>
          <div className="space-y-2"><Label>End date</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" /></div>
          <div className="flex items-center gap-2"><Switch checked={includeDrafts} onCheckedChange={setIncludeDrafts} /><Label>Include drafts</Label></div>
        </CardContent>
      </Card>

      <Tabs defaultValue="trial-balance">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="trial-balance">Trial Balance</TabsTrigger>
          <TabsTrigger value="pl">Statement of Activity</TabsTrigger>
          <TabsTrigger value="bs">Balance Sheet</TabsTrigger>
          <TabsTrigger value="gl">General Ledger</TabsTrigger>
          <TabsTrigger value="funds">Fund Balance</TabsTrigger>
          <TabsTrigger value="ap">AP Aging</TabsTrigger>
          <TabsTrigger value="deposits">Deposits</TabsTrigger>
          <TabsTrigger value="receipts">Missing Receipts</TabsTrigger>
        </TabsList>

        <TabsContent value="trial-balance" className="mt-4">
          <ReportCard title="Trial Balance" loading={tbLoading} onExport={() => exportToCsv("trial-balance.csv", ["Code", "Account", "Debit", "Credit", "Balance"],
            trialBalance.map((r) => [r.account?.code ?? "", r.account?.name ?? "", r.debit, r.credit, r.balance]))}>
            <table className="w-full text-sm"><thead><tr className="border-b text-muted-foreground"><th className="p-2 text-left">Account</th><th className="p-2 text-right">Debit</th><th className="p-2 text-right">Credit</th><th className="p-2 text-right">Balance</th></tr></thead>
              <tbody>{trialBalance.map((r, i) => (
                <tr key={i} className="border-b"><td className="p-2">{r.account?.code} — {r.account?.name}</td>
                  <td className="p-2 text-right">{fmt(r.debit)}</td><td className="p-2 text-right">{fmt(r.credit)}</td><td className="p-2 text-right">{fmt(r.balance)}</td></tr>
              ))}</tbody></table>
          </ReportCard>
        </TabsContent>

        <TabsContent value="pl" className="mt-4">
          <ReportCard title="Statement of Activity (P&L)" onExport={() => exportToCsv("statement-of-activity.csv", ["Type", "Account", "Amount"],
            [...(pl?.revenue ?? []).map((r) => ["Revenue", (r.account as { name: string }).name, r.amount]), ...(pl?.expense ?? []).map((e) => ["Expense", (e.account as { name: string }).name, e.amount])])}>
            <div className="grid md:grid-cols-2 gap-6">
              <div><h4 className="font-medium mb-2">Revenue</h4>{pl?.revenue.map((r, i) => (
                <div key={i} className="flex justify-between text-sm py-1"><span>{(r.account as { name: string }).name}</span><span>{fmt(r.amount)}</span></div>
              ))}<p className="font-medium border-t pt-2 mt-2">Total {fmt(pl?.revenue.reduce((s, r) => s + r.amount, 0) ?? 0)}</p></div>
              <div><h4 className="font-medium mb-2">Expenses</h4>{pl?.expense.map((e, i) => (
                <div key={i} className="flex justify-between text-sm py-1"><span>{(e.account as { name: string }).name}</span><span>{fmt(e.amount)}</span></div>
              ))}<p className="font-medium border-t pt-2 mt-2">Net {fmt(pl?.netIncome ?? 0)}</p></div>
            </div>
          </ReportCard>
        </TabsContent>

        <TabsContent value="bs" className="mt-4">
          <ReportCard title="Statement of Financial Position">
            {(["asset", "liability", "equity"] as const).map((section) => (
              <div key={section} className="mb-4"><h4 className="font-medium capitalize mb-2">{section}s</h4>
                {bs?.[section].map((r, i) => (
                  <div key={i} className="flex justify-between text-sm py-1"><span>{(r.account as { name: string }).name}</span><span>{fmt(r.balance)}</span></div>
                ))}</div>
            ))}
          </ReportCard>
        </TabsContent>

        <TabsContent value="gl" className="mt-4">
          <ReportCard title="General Ledger">
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
          <ReportCard title="Fund Balance Summary">
            <table className="w-full text-sm"><thead><tr className="border-b"><th className="p-2 text-left">Fund</th><th className="p-2 text-right">Balance</th></tr></thead>
              <tbody>{fundBalance.map((f, i) => (
                <tr key={i} className="border-b"><td className="p-2">{(f.fund as { name: string })?.name ?? "Unassigned"}</td><td className="p-2 text-right">{fmt(f.balance)}</td></tr>
              ))}</tbody></table>
          </ReportCard>
        </TabsContent>

        <TabsContent value="ap" className="mt-4">
          <ReportCard title="AP Aging">
            <table className="w-full text-sm"><thead><tr className="border-b"><th className="p-2">Bill</th><th className="p-2">Due</th><th className="p-2">Balance</th><th className="p-2">Bucket</th></tr></thead>
              <tbody>{apAging.map((r, i) => (
                <tr key={i} className="border-b"><td className="p-2 font-mono">{r.bill_number}</td><td className="p-2">{r.due_date || "—"}</td>
                  <td className="p-2">{fmt(r.balance)}</td><td className="p-2">{r.bucket}</td></tr>
              ))}</tbody></table>
          </ReportCard>
        </TabsContent>

        <TabsContent value="deposits" className="mt-4">
          <ReportCard title="Deposit / Revenue Summary">
            <table className="w-full text-sm"><thead><tr className="border-b"><th className="p-2">Number</th><th className="p-2">Date</th><th className="p-2">Source</th><th className="p-2">Amount</th></tr></thead>
              <tbody>{postedDeposits.map((d) => (
                <tr key={d.id} className="border-b"><td className="p-2 font-mono">{d.deposit_number}</td><td className="p-2">{d.deposit_date}</td>
                  <td className="p-2">{FINANCE_DEPOSIT_SOURCE_LABELS[d.source_type]}</td><td className="p-2">{fmt(d.total_amount)}</td></tr>
              ))}</tbody></table>
          </ReportCard>
        </TabsContent>

        <TabsContent value="receipts" className="mt-4">
          <ReportCard title="Missing Receipts">
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

function ReportCard({ title, children, loading, onExport }: { title: string; children: React.ReactNode; loading?: boolean; onExport?: () => void }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        {onExport && <Button variant="outline" size="sm" onClick={onExport}><Download className="h-4 w-4 mr-1" />CSV</Button>}
      </CardHeader>
      <CardContent>{loading ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : children}</CardContent>
    </Card>
  );
}

export default FinanceReportsPage;
