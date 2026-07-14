import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFinanceAccounts } from "@/hooks/useFinanceAccounts";
import {
  useFinanceConnections,
  useFinanceFeedSyncRuns,
  useFinanceIntegrationOutbox,
  useFinancePaymentIntents,
  useFinanceRecurringOccurrences,
  useFinanceRecurringRules,
  useGenerateFinanceRecurringDrafts,
  useQueueFinanceFeedSync,
  useQueueFinancePaymentIntent,
  useSaveFinanceRecurringRule,
} from "@/hooks/useFinanceAutomation";
import { useFinanceAccessCapabilities } from "@/hooks/useFinanceOperations";
import { useFinancePayments } from "@/hooks/useFinancePayments";
import { useWorkspaceNgo } from "@/hooks/useWorkspaceNgo";
import { ArrowRight, CalendarClock, Landmark, Loader2, Plus, RefreshCw, Send, ShieldCheck, Zap } from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);
const initialRule = {
  name: "",
  cadence: "monthly" as "weekly" | "monthly" | "quarterly" | "annual",
  startDate: today(),
  amount: "",
  debitAccountId: "",
  creditAccountId: "",
  memo: "",
};

const FinanceAutomationPage = () => {
  const navigate = useNavigate();
  const { selectedNgo, selectedNgoId } = useWorkspaceNgo();
  const { data: access } = useFinanceAccessCapabilities();
  const { data: accounts = [] } = useFinanceAccounts();
  const { data: rules = [], isLoading: rulesLoading } = useFinanceRecurringRules(selectedNgoId);
  const { data: occurrences = [] } = useFinanceRecurringOccurrences(selectedNgoId);
  const { data: connections = [] } = useFinanceConnections(selectedNgoId);
  const { data: syncRuns = [] } = useFinanceFeedSyncRuns(selectedNgoId);
  const { data: paymentIntents = [] } = useFinancePaymentIntents(selectedNgoId);
  const { data: outbox = [] } = useFinanceIntegrationOutbox(selectedNgoId, !!access?.can_review);
  const { data: payments = [] } = useFinancePayments("all", selectedNgoId);
  const saveRule = useSaveFinanceRecurringRule();
  const generateDrafts = useGenerateFinanceRecurringDrafts();
  const queueSync = useQueueFinanceFeedSync();
  const queuePayment = useQueueFinancePaymentIntent();
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState(initialRule);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [providerPaymentId, setProviderPaymentId] = useState("");
  const [providerName, setProviderName] = useState("");

  const pendingProviderPayments = useMemo(() => {
    const used = new Set(paymentIntents.map((intent) => intent.payment_id));
    return payments.filter((payment) => ["draft", "pending_approval"].includes(payment.status) && !used.has(payment.id));
  }, [paymentIntents, payments]);

  const createRule = async () => {
    if (!selectedNgoId) return;
    const amount = Number(ruleForm.amount);
    await saveRule.mutateAsync({
      header: {
        ngo_id: selectedNgoId,
        name: ruleForm.name.trim(),
        cadence: ruleForm.cadence,
        interval_count: 1,
        start_date: ruleForm.startDate,
        next_run_on: ruleForm.startDate,
        status: "active",
      },
      template: {
        memo: ruleForm.memo.trim() || ruleForm.name.trim(),
        lines: [
          { account_id: ruleForm.debitAccountId, debit: amount, credit: 0, memo: ruleForm.memo.trim() || undefined },
          { account_id: ruleForm.creditAccountId, debit: 0, credit: amount, memo: ruleForm.memo.trim() || undefined },
        ],
      },
    });
    setRuleForm(initialRule);
    setRuleDialogOpen(false);
  };

  const toggleRule = (rule: typeof rules[number]) => {
    saveRule.mutate({
      id: rule.id,
      header: { status: rule.status === "active" ? "paused" : "active" },
      template: rule.template_json,
    });
  };

  const submitProviderPayment = async () => {
    if (!providerPaymentId || !providerName.trim()) return;
    await queuePayment.mutateAsync({ paymentId: providerPaymentId, provider: providerName });
    setPaymentDialogOpen(false);
    setProviderPaymentId("");
    setProviderName("");
  };

  const selectedName = selectedNgo?.common_name || selectedNgo?.legal_name;

  return (
    <MainLayout
      title="Finance Automation & Connections"
      subtitle={selectedName ? `Reviewable automation and provider activity for ${selectedName}` : "Select an NGO to manage its accounting automation"}
    >
      {!selectedNgoId ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Select an NGO in the workspace header. Automation is always isolated to one NGO ledger.</CardContent></Card>
      ) : (
        <div className="space-y-6">
          <Card className="border-primary/30">
            <CardContent className="p-4 flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Automation never bypasses review or the ledger</p>
                <p className="text-sm text-muted-foreground">Recurring rules generate balanced draft journals. Provider payments post only after confirmed settlement, and every request has an idempotent outbox record.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div><CardTitle className="text-base flex items-center gap-2"><CalendarClock className="h-4 w-4" />Recurring journal rules</CardTitle><CardDescription>Generate predictable entries as drafts for review and posting.</CardDescription></div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => generateDrafts.mutate(today())} disabled={!access?.can_review || generateDrafts.isPending}>
                  {generateDrafts.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Zap className="h-4 w-4 mr-1" />}Generate due drafts
                </Button>
                <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
                  <DialogTrigger asChild><Button disabled={!access?.can_review}><Plus className="h-4 w-4 mr-1" />New rule</Button></DialogTrigger>
                  <DialogContent className="max-w-xl">
                    <DialogHeader><DialogTitle>New recurring journal rule</DialogTitle></DialogHeader>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2 sm:col-span-2"><Label>Name</Label><Input value={ruleForm.name} onChange={(event) => setRuleForm((form) => ({ ...form, name: event.target.value }))} placeholder="Monthly software subscription" /></div>
                      <div className="space-y-2"><Label>Cadence</Label><Select value={ruleForm.cadence} onValueChange={(cadence: typeof ruleForm.cadence) => setRuleForm((form) => ({ ...form, cadence }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="quarterly">Quarterly</SelectItem><SelectItem value="annual">Annual</SelectItem></SelectContent></Select></div>
                      <div className="space-y-2"><Label>First date</Label><Input type="date" value={ruleForm.startDate} onChange={(event) => setRuleForm((form) => ({ ...form, startDate: event.target.value }))} /></div>
                      <div className="space-y-2"><Label>Amount</Label><Input type="number" min="0.01" step="0.01" value={ruleForm.amount} onChange={(event) => setRuleForm((form) => ({ ...form, amount: event.target.value }))} /></div>
                      <div className="space-y-2"><Label>Debit account</Label><AccountSelect value={ruleForm.debitAccountId} onChange={(debitAccountId) => setRuleForm((form) => ({ ...form, debitAccountId }))} accounts={accounts} /></div>
                      <div className="space-y-2"><Label>Credit account</Label><AccountSelect value={ruleForm.creditAccountId} onChange={(creditAccountId) => setRuleForm((form) => ({ ...form, creditAccountId }))} accounts={accounts} /></div>
                      <div className="space-y-2 sm:col-span-2"><Label>Memo</Label><Input value={ruleForm.memo} onChange={(event) => setRuleForm((form) => ({ ...form, memo: event.target.value }))} /></div>
                    </div>
                    <p className="text-xs text-muted-foreground">Selecting a canonical account automatically activates it in this NGO ledger.</p>
                    <Button onClick={createRule} disabled={!ruleForm.name.trim() || !ruleForm.debitAccountId || !ruleForm.creditAccountId || ruleForm.debitAccountId === ruleForm.creditAccountId || Number(ruleForm.amount) <= 0 || saveRule.isPending}>Save rule</Button>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Rule</TableHead><TableHead>Cadence</TableHead><TableHead>Next draft</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {rulesLoading ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading rules…</TableCell></TableRow> : !rules.length ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No recurring rules yet.</TableCell></TableRow> : rules.map((rule) => (
                    <TableRow key={rule.id}><TableCell className="font-medium">{rule.name}</TableCell><TableCell className="capitalize">{rule.cadence}</TableCell><TableCell>{rule.next_run_on}</TableCell><TableCell><StatusBadge status={rule.status} /></TableCell><TableCell className="text-right"><Button size="sm" variant="outline" disabled={!access?.can_review || rule.status === "ended"} onClick={() => toggleRule(rule)}>{rule.status === "active" ? "Pause" : "Resume"}</Button></TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
              {occurrences.length ? <p className="text-xs text-muted-foreground mt-3">Latest generation: {occurrences[0].occurrence_date} · {occurrences[0].status.replace(/_/g, " ")}</p> : null}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Landmark className="h-4 w-4" />Bank feed connections</CardTitle><CardDescription>Provider-neutral, auditable import queue.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                {!connections.length ? <p className="text-sm text-muted-foreground">No bank provider adapter is connected yet. The secure connection and sync queue are ready for a Plaid, Stripe Financial Connections, or bank-specific adapter.</p> : connections.map((connection) => (
                  <div key={connection.id} className="rounded-md border p-3 flex items-center justify-between gap-3">
                    <div><p className="text-sm font-medium">{connection.institution_name || connection.provider}</p><p className="text-xs text-muted-foreground">{connection.last_synced_at ? `Last synced ${new Date(connection.last_synced_at).toLocaleString()}` : "Not synced yet"}</p></div>
                    <div className="flex items-center gap-2"><StatusBadge status={connection.status} /><Button size="sm" variant="outline" disabled={connection.status !== "active" || !access?.can_review || queueSync.isPending} onClick={() => queueSync.mutate({ connectionId: connection.id, through: today() })}><RefreshCw className="h-4 w-4 mr-1" />Sync</Button></div>
                  </div>
                ))}
                {syncRuns.length ? <p className="text-xs text-muted-foreground">Latest sync: {syncRuns[0].status} · {syncRuns[0].imported_count} imported · {syncRuns[0].duplicate_count} duplicates</p> : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div><CardTitle className="text-base flex items-center gap-2"><Send className="h-4 w-4" />Provider payments</CardTitle><CardDescription>Money movement remains separate from ledger posting until settlement is confirmed.</CardDescription></div>
                <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
                  <DialogTrigger asChild><Button size="sm" disabled={!access?.can_review || !pendingProviderPayments.length}>Queue payment</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Queue a provider payment</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2"><Label>Prepared payment</Label><Select value={providerPaymentId} onValueChange={setProviderPaymentId}><SelectTrigger><SelectValue placeholder="Choose a draft or pending payment" /></SelectTrigger><SelectContent>{pendingProviderPayments.map((payment) => <SelectItem key={payment.id} value={payment.id}>{payment.payment_number || "Draft"} · {payment.payee_name || "Payee"} · {Number(payment.amount).toLocaleString(undefined, { style: "currency", currency: "USD" })}</SelectItem>)}</SelectContent></Select></div>
                      <div className="space-y-2"><Label>Provider adapter</Label><Input value={providerName} onChange={(event) => setProviderName(event.target.value)} placeholder="e.g. stripe, ach-provider" /></div>
                      <p className="text-xs text-muted-foreground">This creates an idempotent request for an installed provider worker. It does not mark the payment posted.</p>
                      <Button onClick={submitProviderPayment} disabled={!providerPaymentId || !providerName.trim() || queuePayment.isPending}>Queue safely</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="space-y-3">
                {!paymentIntents.length ? <p className="text-sm text-muted-foreground">No provider payment requests yet.</p> : paymentIntents.slice(0, 6).map((intent) => (
                  <div key={intent.id} className="rounded-md border p-3 flex items-center justify-between gap-3"><div><p className="text-sm font-medium">{intent.provider} · {intent.amount.toLocaleString(undefined, { style: "currency", currency: intent.currency })}</p><p className="text-xs text-muted-foreground">{new Date(intent.created_at).toLocaleString()}</p></div><StatusBadge status={intent.status} /></div>
                ))}
              </CardContent>
            </Card>
          </div>

          {access?.can_review ? (
            <Card>
              <CardHeader><CardTitle className="text-base">Integration outbox</CardTitle><CardDescription>Durable delivery records expose retries and failures instead of hiding them.</CardDescription></CardHeader>
              <CardContent>
                {!outbox.length ? <p className="text-sm text-muted-foreground">No queued integration work.</p> : <div className="space-y-2">{outbox.slice(0, 10).map((item) => <div key={item.id} className="rounded-md border p-3 flex items-center justify-between gap-3"><div><p className="text-sm font-medium">{item.event_type.replace(/_/g, " ")}</p><p className="text-xs text-muted-foreground">Attempts: {item.attempt_count} · {new Date(item.created_at).toLocaleString()}</p></div><StatusBadge status={item.status} /></div>)}</div>}
              </CardContent>
            </Card>
          ) : null}

          <Button variant="outline" onClick={() => navigate("/financial-hub/accounting/journal-entries")}>Review generated journal drafts <ArrowRight className="h-4 w-4 ml-1" /></Button>
        </div>
      )}
    </MainLayout>
  );
};

const AccountSelect = ({ value, onChange, accounts }: { value: string; onChange: (value: string) => void; accounts: Array<{ id: string; code: string; name: string }> }) => (
  <Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue placeholder="Choose account" /></SelectTrigger><SelectContent>{accounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.code} · {account.name}</SelectItem>)}</SelectContent></Select>
);

const StatusBadge = ({ status }: { status: string }) => {
  const variant = ["active", "succeeded", "settled", "sent", "draft_generated"].includes(status)
    ? "default"
    : ["failed", "error", "reauthorization_required"].includes(status)
      ? "destructive"
      : "secondary";
  return <Badge variant={variant}>{status.replace(/_/g, " ")}</Badge>;
};

export default FinanceAutomationPage;
