import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, CheckCircle, TrendingUp, Settings } from "lucide-react";
import { useFinanceAccounts } from "@/hooks/useFinanceAccounts";
import { useFinanceBankAccounts } from "@/hooks/useFinanceBankAccounts";
import { useFinanceFunds } from "@/hooks/useFinanceFunds";
import {
  useCalculateAdminFee, useFinanceAdminFeeRules, useFinanceDeposits, usePostFinanceDeposit, useSaveAdminFeeRule, useSaveFinanceDeposit,
} from "@/hooks/useFinanceDeposits";
import { FINANCE_DEPOSIT_SOURCE_LABELS, type FinanceDepositInput, type FinanceDepositLineInput, type FinanceDepositSource } from "@/types/financeAccounting";
import { useWorkspaceNgo } from "@/hooks/useWorkspaceNgo";

const fmt = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

const FinanceDepositsPage = () => {
  const { selectedNgo, selectedNgoId } = useWorkspaceNgo();
  const { data: deposits = [], isLoading } = useFinanceDeposits(selectedNgoId);
  const { data: bankAccounts = [] } = useFinanceBankAccounts({ ngoId: selectedNgoId });
  const { data: accounts = [] } = useFinanceAccounts();
  const { data: funds = [] } = useFinanceFunds();
  const { data: rules = [] } = useFinanceAdminFeeRules();
  const saveDeposit = useSaveFinanceDeposit();
  const postDeposit = usePostFinanceDeposit();
  const saveRule = useSaveAdminFeeRule();

  const [depositDate, setDepositDate] = useState(new Date().toISOString().slice(0, 10));
  const [sourceType, setSourceType] = useState<FinanceDepositSource>("donation");
  const [bankId, setBankId] = useState("none");
  const [grossAmount, setGrossAmount] = useState("");
  const [feeOverride, setFeeOverride] = useState("");
  const [revenueAccountId, setRevenueAccountId] = useState("none");
  const [memo, setMemo] = useState("");
  const [defaultFeePct, setDefaultFeePct] = useState("10");

  const gross = Number(grossAmount) || 0;
  const { data: feeCalc } = useCalculateAdminFee(gross, selectedNgoId, null);
  const appliedFee = feeOverride ? Number(feeOverride) : (feeCalc?.suggested_fee ?? 0);
  const passThrough = gross - appliedFee;

  const revenueAccounts = useMemo(() => accounts.filter((a) => a.account_type === "revenue"), [accounts]);

  const handleCreateDeposit = async () => {
    if (!selectedNgoId || bankId === "none" || gross <= 0) return;
    const lines: FinanceDepositLineInput[] = [];
    const adminFeeAcct = accounts.find((a) => a.code === "4300")?.id;
    const passAcct = revenueAccountId !== "none" ? revenueAccountId : revenueAccounts[0]?.id;
    if (!passAcct) return;

    if (sourceType === "admin_fee" || appliedFee > 0) {
      if (appliedFee > 0 && adminFeeAcct) {
        lines.push({ revenue_account_id: adminFeeAcct, amount: appliedFee, ngo_id: selectedNgoId, memo: "HPG admin fee", line_number: 1 });
      }
      if (passThrough > 0) {
        lines.push({ revenue_account_id: passAcct, amount: passThrough, ngo_id: selectedNgoId, fund_id: null, memo: "Pass-through amount", line_number: lines.length + 1 });
      }
    } else {
      lines.push({ revenue_account_id: passAcct, amount: gross, ngo_id: selectedNgoId, line_number: 1 });
    }

    const input: FinanceDepositInput = {
      deposit_date: depositDate, source_type: sourceType, bank_account_id: bankId,
      ngo_id: selectedNgoId,
      memo: memo.trim() || null, restriction_notes: "NGO deposit", lines,
    };
    const dep = await saveDeposit.mutateAsync({ input });
    if (dep?.id) await postDeposit.mutateAsync(dep.id);
  };

  const handleSaveDefaultRule = async () => {
    const defaultRule = rules.find((r) => !r.ngo_id && !r.grant_application_id);
    await saveRule.mutateAsync({
      id: defaultRule?.id,
      name: "Default admin fee (demo seed)",
      default_percentage: Number(defaultFeePct) || 10,
      is_active: true,
    });
  };

  return (
    <MainLayout title="Deposits & Revenue" subtitle={`Incoming money and revenue classification for ${selectedNgo?.common_name || selectedNgo?.legal_name || "All HPG"}`}>
      <Tabs defaultValue="deposits">
        <TabsList>
          <TabsTrigger value="deposits"><TrendingUp className="h-4 w-4 mr-1" />Deposits</TabsTrigger>
          <TabsTrigger value="admin-fees"><Settings className="h-4 w-4 mr-1" />Admin fee rules</TabsTrigger>
        </TabsList>

        <TabsContent value="deposits" className="space-y-6 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Record deposit</CardTitle>
              <CardDescription>Posts Dr Bank / Cr Revenue (splits admin fee vs pass-through for sponsored NGOs).</CardDescription></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>Deposit date</Label><Input type="date" value={depositDate} onChange={(e) => setDepositDate(e.target.value)} /></div>
              <div className="space-y-2"><Label>Source</Label>
                <Select value={sourceType} onValueChange={(v) => setSourceType(v as FinanceDepositSource)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(FINANCE_DEPOSIT_SOURCE_LABELS) as FinanceDepositSource[]).map((s) => (
                    <SelectItem key={s} value={s}>{FINANCE_DEPOSIT_SOURCE_LABELS[s]}</SelectItem>
                  ))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Bank account</Label>
                <Select value={bankId} onValueChange={setBankId}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">Select</SelectItem>{bankAccounts.map((b) => <SelectItem key={b.id} value={b.id}>{b.account_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Entity</Label><Input value={selectedNgo?.common_name || selectedNgo?.legal_name || "Select an NGO in the workspace header"} readOnly className="bg-muted/40" /></div>
              <div className="space-y-2"><Label>Gross amount</Label><Input type="number" step="0.01" value={grossAmount} onChange={(e) => setGrossAmount(e.target.value)} /></div>
              <div className="space-y-2"><Label>Revenue account</Label>
                <Select value={revenueAccountId} onValueChange={setRevenueAccountId}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">Default</SelectItem>{revenueAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {selectedNgoId && gross > 0 && (
                <div className="md:col-span-2 rounded-md border p-4 bg-muted/30 space-y-2">
                  <p className="text-sm font-medium">Suggested admin fee split</p>
                  <p className="text-sm">Fee ({feeCalc?.fee_percentage ?? 10}%): {fmt(appliedFee)} · Pass-through: {fmt(passThrough)}</p>
                  <div className="space-y-2"><Label>Override fee amount</Label><Input type="number" step="0.01" value={feeOverride} onChange={(e) => setFeeOverride(e.target.value)} placeholder="Leave blank to accept suggested" /></div>
                </div>
              )}
              <div className="md:col-span-2 space-y-2"><Label>Memo</Label><Input value={memo} onChange={(e) => setMemo(e.target.value)} /></div>
              <div className="md:col-span-2"><Button onClick={handleCreateDeposit} disabled={!selectedNgoId || saveDeposit.isPending || postDeposit.isPending || bankId === "none" || gross <= 0}>
                {saveDeposit.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}Save & post deposit
              </Button></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Deposit history</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : deposits.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No deposits recorded.</p>
              ) : (
                <table className="w-full text-sm"><thead><tr className="border-b text-muted-foreground"><th className="p-2 text-left">Number</th><th className="p-2">Date</th><th className="p-2">Source</th><th className="p-2">Amount</th><th className="p-2">Status</th></tr></thead>
                  <tbody>{deposits.map((d) => (
                    <tr key={d.id} className="border-b"><td className="p-2 font-mono">{d.deposit_number}</td><td className="p-2">{d.deposit_date}</td>
                      <td className="p-2">{FINANCE_DEPOSIT_SOURCE_LABELS[d.source_type]}</td><td className="p-2">{fmt(d.total_amount)}</td>
                      <td className="p-2"><Badge>{d.status}</Badge></td></tr>
                  ))}</tbody></table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="admin-fees" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Admin fee settings</CardTitle>
              <CardDescription>Default percentage for fiscal sponsorship deposits. NGO/grant overrides can be added via admin fee rules table.</CardDescription></CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <div className="space-y-2"><Label>Default fee percentage</Label><Input type="number" min={0} max={100} step="0.01" value={defaultFeePct} onChange={(e) => setDefaultFeePct(e.target.value)} /></div>
              <Button onClick={handleSaveDefaultRule} disabled={saveRule.isPending}>Save default rule</Button>
              <div className="text-sm text-muted-foreground">{rules.length} rule(s) configured (includes demo seed if migration applied).</div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
};

export default FinanceDepositsPage;
