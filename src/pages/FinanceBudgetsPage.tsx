import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus } from "lucide-react";
import { useFinanceAccounts } from "@/hooks/useFinanceAccounts";
import { useBudgetVsActual, useFinanceBudgets, useSaveFinanceBudget } from "@/hooks/useFinanceBudgets";

const fmt = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

const FinanceBudgetsPage = () => {
  const { data: budgets = [], isLoading } = useFinanceBudgets();
  const { data: accounts = [] } = useFinanceAccounts();
  const saveBudget = useSaveFinanceBudget();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [fiscalYear, setFiscalYear] = useState(String(new Date().getFullYear()));
  const [accountId, setAccountId] = useState("none");
  const [month, setMonth] = useState("1");
  const [amount, setAmount] = useState("");

  const selected = budgets.find((b) => b.id === selectedId);
  const { data: vsActual = [] } = useBudgetVsActual(selectedId, selected?.fiscal_year ?? new Date().getFullYear());

  const handleCreateBudget = async () => {
    const b = await saveBudget.mutateAsync({ header: { name: name.trim() || `FY${fiscalYear} Budget`, fiscal_year: Number(fiscalYear), scope_type: "organization", status: "draft" } });
    setSelectedId((b as { id: string }).id);
  };

  const handleAddLine = async () => {
    if (!selectedId || accountId === "none" || !selected) return;
    const existing = (selected.lines || []).map((l) => ({
      account_id: l.account_id, period_month: l.period_month, amount: l.amount, memo: l.memo ?? undefined,
    }));
    await saveBudget.mutateAsync({
      id: selectedId,
      header: {},
      lines: [...existing, { account_id: accountId, period_month: Number(month), amount: Number(amount) || 0 }],
    });
  };

  return (
    <MainLayout title="Budgets" subtitle="Nonprofit budget tracking with budget vs actual from posted journal lines">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Create budget</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`FY${fiscalYear} Organization Budget`} /></div>
            <div className="space-y-2"><Label>Fiscal year</Label><Input type="number" value={fiscalYear} onChange={(e) => setFiscalYear(e.target.value)} /></div>
            <Button onClick={handleCreateBudget} disabled={saveBudget.isPending}><Plus className="h-4 w-4 mr-2" />Create budget</Button>
            <div className="pt-4 space-y-2">
              <Label>Budgets</Label>
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : budgets.map((b) => (
                <button key={b.id} type="button" className={`block w-full text-left rounded border p-2 text-sm ${selectedId === b.id ? "border-primary bg-muted/30" : ""}`} onClick={() => setSelectedId(b.id)}>
                  {b.name} (FY{b.fiscal_year}) — {b.status}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Budget lines</CardTitle>
            <CardDescription>{selected ? selected.name : "Select a budget"}</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {selected && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <Select value={accountId} onValueChange={setAccountId}><SelectTrigger><SelectValue placeholder="Account" /></SelectTrigger>
                    <SelectContent><SelectItem value="none">Account</SelectItem>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.code}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={month} onValueChange={setMonth}><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <SelectItem key={m} value={String(m)}>Month {m}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <Button size="sm" onClick={handleAddLine} disabled={accountId === "none"}>Add line</Button>
                <table className="w-full text-sm mt-4"><thead><tr className="border-b text-muted-foreground"><th className="p-2">Account</th><th className="p-2">Month</th><th className="p-2">Budget</th><th className="p-2">Actual</th><th className="p-2">Variance</th></tr></thead>
                  <tbody>{(selected.lines || []).map((l) => {
                    const va = vsActual.find((v) => v.account_id === l.account_id && v.period_month === l.period_month);
                    const acct = accounts.find((a) => a.id === l.account_id);
                    return <tr key={l.id} className="border-b"><td className="p-2">{acct?.code}</td><td className="p-2">{l.period_month}</td>
                      <td className="p-2">{fmt(l.amount)}</td><td className="p-2">{fmt(va?.actual ?? 0)}</td><td className="p-2">{fmt(va?.variance ?? 0)}</td></tr>;
                  })}</tbody></table>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default FinanceBudgetsPage;
