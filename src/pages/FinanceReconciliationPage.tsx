import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, CheckCircle } from "lucide-react";
import { useFinanceBankAccounts } from "@/hooks/useFinanceBankAccounts";
import {
  useCreateReconciliation, useFinalizeReconciliation, useFinanceReconciliationItems, useFinanceReconciliations, useRefreshReconciliationBalances, useToggleReconItemCleared,
} from "@/hooks/useFinanceReconciliation";

const fmt = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

const FinanceReconciliationPage = () => {
  const { data: recons = [], isLoading } = useFinanceReconciliations();
  const { data: bankAccounts = [] } = useFinanceBankAccounts();
  const createRecon = useCreateReconciliation();
  const finalize = useFinalizeReconciliation();
  const refreshBalances = useRefreshReconciliationBalances();
  const toggleCleared = useToggleReconItemCleared();

  const [bankId, setBankId] = useState("none");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [beginBal, setBeginBal] = useState("0");
  const [endBal, setEndBal] = useState("0");
  const [activeReconId, setActiveReconId] = useState<string | null>(null);
  const [exceptionNotes, setExceptionNotes] = useState("");

  const { data: items = [] } = useFinanceReconciliationItems(activeReconId);
  const activeRecon = recons.find((r) => r.id === activeReconId);
  const clearedTotal = items.filter((i) => i.is_cleared).reduce((s, i) => s + i.amount, 0);
  const difference = activeRecon ? activeRecon.ending_balance - (activeRecon.beginning_balance + clearedTotal) : 0;

  return (
    <MainLayout title="Bank Reconciliation" subtitle="Manual QuickBooks-style reconciliation — mark cleared items and finalize when balanced">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Start reconciliation</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Bank account</Label>
              <Select value={bankId} onValueChange={setBankId}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">Select</SelectItem>{bankAccounts.map((b) => <SelectItem key={b.id} value={b.id}>{b.account_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Statement start</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
              <div className="space-y-2"><Label>Statement end</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Beginning balance</Label><Input type="number" step="0.01" value={beginBal} onChange={(e) => setBeginBal(e.target.value)} /></div>
              <div className="space-y-2"><Label>Ending balance</Label><Input type="number" step="0.01" value={endBal} onChange={(e) => setEndBal(e.target.value)} /></div>
            </div>
            <Button disabled={bankId === "none" || createRecon.isPending} onClick={async () => {
              const r = await createRecon.mutateAsync({ bank_account_id: bankId, statement_start_date: startDate, statement_end_date: endDate, beginning_balance: Number(beginBal), ending_balance: Number(endBal) });
              setActiveReconId((r as { id: string }).id);
            }}><Plus className="h-4 w-4 mr-2" />Start</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Reconciliations</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : recons.length === 0 ? (
              <p className="text-sm text-muted-foreground">No reconciliations yet.</p>
            ) : recons.map((r) => (
              <button key={r.id} type="button" className={`w-full text-left rounded border p-3 mb-2 hover:bg-muted/40 ${activeReconId === r.id ? "border-primary" : ""}`} onClick={() => setActiveReconId(r.id)}>
                <div className="flex justify-between"><span className="font-medium">{r.statement_start_date} — {r.statement_end_date}</span><Badge>{r.status}</Badge></div>
                <p className="text-xs text-muted-foreground mt-1">Diff: {fmt(r.difference)}</p>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {activeRecon && activeRecon.status === "in_progress" && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Clear transactions</CardTitle>
            <CardDescription>
              Book balance: {fmt(Number(activeRecon.book_balance ?? 0))} · Cleared: {fmt(clearedTotal)} · Difference: {fmt(difference)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" size="sm" onClick={() => refreshBalances.mutate(activeRecon.id)} disabled={refreshBalances.isPending}>
              Refresh book balance
            </Button>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm"><thead><tr className="border-b text-muted-foreground"><th className="p-2">Date</th><th className="p-2">Description</th><th className="p-2">Amount</th><th className="p-2">Cleared</th></tr></thead>
                <tbody>{items.map((item) => (
                  <tr key={item.id} className="border-b"><td className="p-2">{item.transaction_date || "—"}</td><td className="p-2">{item.description || "—"}</td>
                    <td className="p-2">{fmt(item.amount)}</td><td className="p-2">
                      <Switch checked={item.is_cleared} disabled={!!item.locked_at} onCheckedChange={(v) => toggleCleared.mutate({ itemId: item.id, isCleared: v })} />
                    </td></tr>
                ))}</tbody></table>
            </div>
            {difference !== 0 && (
              <div className="space-y-2"><Label>Exception notes (required if difference ≠ 0)</Label><Textarea value={exceptionNotes} onChange={(e) => setExceptionNotes(e.target.value)} /></div>
            )}
            <Button onClick={() => finalize.mutate({ id: activeRecon.id, exceptionNotes: difference !== 0 ? exceptionNotes : undefined })} disabled={finalize.isPending || (difference !== 0 && !exceptionNotes.trim())}>
              <CheckCircle className="h-4 w-4 mr-2" />Finalize reconciliation
            </Button>
          </CardContent>
        </Card>
      )}
    </MainLayout>
  );
};

export default FinanceReconciliationPage;
