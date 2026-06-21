import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useFinanceFiscalPeriods,
  useFinanceOpeningBalances,
  useUpsertFinanceOpeningBalance,
} from "@/hooks/useFinanceFiscalPeriods";
import { useFinanceAccounts } from "@/hooks/useFinanceAccounts";
import { hasFinancePermission } from "@/lib/financePermissions";
import { useUserRole } from "@/hooks/useUserRole";

const fmt = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

const FinanceOpeningBalancesPage = () => {
  const { role } = useUserRole();
  const canManage = hasFinancePermission(role, "edit_settings");
  const { data: periods = [] } = useFinanceFiscalPeriods();
  const { data: accounts = [] } = useFinanceAccounts();
  const [periodId, setPeriodId] = useState("");
  const { data: balances = [] } = useFinanceOpeningBalances(periodId || undefined);
  const upsert = useUpsertFinanceOpeningBalance();

  const [accountId, setAccountId] = useState("none");
  const [debit, setDebit] = useState(0);
  const [credit, setCredit] = useState(0);

  const selectedPeriod = periods.find((p) => p.id === periodId);
  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  return (
    <MainLayout title="Opening Balances" subtitle="Beginning balances by fiscal period and account">
      <Card className="mb-4">
        <CardContent className="pt-6">
          <Label>Fiscal period</Label>
          <Select value={periodId} onValueChange={setPeriodId}>
            <SelectTrigger className="max-w-md mt-2"><SelectValue placeholder="Select period" /></SelectTrigger>
            <SelectContent>
              {periods.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.label} ({p.status})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedPeriod?.status === "locked" && (
            <p className="text-sm text-destructive mt-2">This period is locked — opening balances cannot be edited.</p>
          )}
        </CardContent>
      </Card>

      {periodId && canManage && selectedPeriod?.status !== "locked" && (
        <Card className="mb-4">
          <CardHeader><CardTitle className="text-base">Add / update balance</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-4 gap-3 items-end">
            <div>
              <Label>Account</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue placeholder="Account" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select</SelectItem>
                  {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Debit</Label><Input type="number" value={debit || ""} onChange={(e) => setDebit(Number(e.target.value))} /></div>
            <div><Label>Credit</Label><Input type="number" value={credit || ""} onChange={(e) => setCredit(Number(e.target.value))} /></div>
            <Button
              disabled={accountId === "none" || (debit <= 0 && credit <= 0)}
              onClick={() => upsert.mutate({
                fiscal_period_id: periodId,
                account_id: accountId,
                debit,
                credit,
              }, { onSuccess: () => { setDebit(0); setCredit(0); setAccountId("none"); } })}
            >
              Save
            </Button>
          </CardContent>
        </Card>
      )}

      {periodId && (
        <Card>
          <CardHeader><CardTitle className="text-base">Opening balances — {selectedPeriod?.label}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {balances.map((b) => {
                  const acct = accountMap.get(b.account_id);
                  return (
                    <TableRow key={b.id}>
                      <TableCell>{acct ? `${acct.code} — ${acct.name}` : b.account_id}</TableCell>
                      <TableCell className="text-right">{b.debit > 0 ? fmt(b.debit) : "—"}</TableCell>
                      <TableCell className="text-right">{b.credit > 0 ? fmt(b.credit) : "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </MainLayout>
  );
};

export default FinanceOpeningBalancesPage;
