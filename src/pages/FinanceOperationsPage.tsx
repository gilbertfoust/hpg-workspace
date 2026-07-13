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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useFinanceBudgets, useReviewFinanceBudget } from "@/hooks/useFinanceBudgets";
import {
  useFinanceAccessCapabilities,
  useFinanceExpenseRequests,
  useFinanceWorkflowEvents,
  useMarkFinanceExpensePaid,
  useReviewFinanceExpenseRequest,
  useSaveFinanceExpenseRequest,
  useSubmitFinanceExpenseRequest,
} from "@/hooks/useFinanceOperations";
import { useNGOs } from "@/hooks/useNGOs";
import { usePurchaseRequests } from "@/hooks/usePurchaseRequests";
import { ArrowRight, Bell, Check, CircleDollarSign, FileCheck, Plus, Send, ShoppingCart, Wallet, X } from "lucide-react";

const money = (amount: number, currency = "USD") =>
  amount.toLocaleString(undefined, { style: "currency", currency });

const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  if (["approved", "paid", "sent", "active"].includes(status)) return "default";
  if (["rejected", "failed", "canceled"].includes(status)) return "destructive";
  if (["submitted", "pending_approval", "queued"].includes(status)) return "secondary";
  return "outline";
};

type ApprovalItem = {
  id: string;
  kind: "Expense" | "Purchase" | "Budget";
  label: string;
  amount: number;
  workItemId: string | null;
  submittedAt: string | null;
};

const initialExpenseForm = {
  payeeName: "",
  expenseDate: new Date().toISOString().slice(0, 10),
  amount: "",
  category: "operations",
  businessPurpose: "",
  description: "",
  ngoId: "none",
};

const FinanceOperationsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: access } = useFinanceAccessCapabilities();
  const { data: expenses = [], isLoading: expensesLoading } = useFinanceExpenseRequests();
  const { data: purchases = [], updateStatus: updatePurchaseStatus } = usePurchaseRequests();
  const { data: budgets = [] } = useFinanceBudgets();
  const { data: workflowEvents = [] } = useFinanceWorkflowEvents();
  const { data: ngos = [] } = useNGOs();
  const saveExpense = useSaveFinanceExpenseRequest();
  const submitExpense = useSubmitFinanceExpenseRequest();
  const reviewExpense = useReviewFinanceExpenseRequest();
  const markExpensePaid = useMarkFinanceExpensePaid();
  const reviewBudget = useReviewFinanceBudget();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState(initialExpenseForm);

  const approvalQueue = useMemo<ApprovalItem[]>(() => {
    const rows: ApprovalItem[] = [
      ...expenses.filter((item) => item.status === "submitted").map((item) => ({
        id: item.id,
        kind: "Expense" as const,
        label: `${item.request_number} · ${item.payee_name}`,
        amount: Number(item.amount),
        workItemId: item.work_item_id,
        submittedAt: item.submitted_at,
      })),
      ...purchases.filter((item) => item.status === "pending_approval").map((item) => ({
        id: item.id,
        kind: "Purchase" as const,
        label: item.title,
        amount: Number(item.estimated_amount ?? 0),
        workItemId: item.work_item_id ?? null,
        submittedAt: item.submitted_at ?? null,
      })),
      ...budgets.filter((item) => item.status === "pending_approval").map((item) => ({
        id: item.id,
        kind: "Budget" as const,
        label: `${item.name} · FY${item.fiscal_year}`,
        amount: (item.lines ?? []).reduce((sum, line) => sum + Number(line.amount), 0),
        workItemId: item.work_item_id ?? null,
        submittedAt: item.submitted_at ?? null,
      })),
    ];
    return rows.sort((a, b) => (a.submittedAt ?? "").localeCompare(b.submittedAt ?? ""));
  }, [budgets, expenses, purchases]);

  const queuedNotifications = workflowEvents.filter((event) => event.notification_status === "queued").length;
  const ownDrafts = expenses.filter((item) => item.requester_user_id === user?.id && item.status === "draft").length;

  const createExpense = async () => {
    await saveExpense.mutateAsync({
      input: {
        payee_name: expenseForm.payeeName.trim(),
        expense_date: expenseForm.expenseDate,
        amount: Number(expenseForm.amount),
        category: expenseForm.category,
        business_purpose: expenseForm.businessPurpose.trim(),
        description: expenseForm.description.trim() || undefined,
        ngo_id: expenseForm.ngoId === "none" ? undefined : expenseForm.ngoId,
        currency_code: "USD",
      },
    });
    setExpenseForm(initialExpenseForm);
    setDialogOpen(false);
  };

  const reject = (kind: ApprovalItem["kind"], id: string) => {
    const reason = window.prompt(`Why is this ${kind.toLowerCase()} request being rejected?`);
    if (!reason?.trim()) return;
    if (kind === "Expense") reviewExpense.mutate({ id, decision: "rejected", reason: reason.trim() });
    if (kind === "Purchase") updatePurchaseStatus.mutate({ id, status: "rejected", rejected_reason: reason.trim() });
    if (kind === "Budget") reviewBudget.mutate({ id, decision: "rejected", reason: reason.trim() });
  };

  const approve = (kind: ApprovalItem["kind"], id: string) => {
    if (kind === "Expense") reviewExpense.mutate({ id, decision: "approved" });
    if (kind === "Purchase") updatePurchaseStatus.mutate({ id, status: "approved" });
    if (kind === "Budget") reviewBudget.mutate({ id, decision: "approved" });
  };

  return (
    <MainLayout title="Finance Operations" subtitle="Expense, purchase, and budget requests with database-enforced approvals">
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Pending approvals" value={approvalQueue.length} icon={FileCheck} />
          <MetricCard label="My expense drafts" value={ownDrafts} icon={Wallet} />
          <MetricCard label="Queued notifications" value={queuedNotifications} icon={Bell} />
          <MetricCard label="Open expense requests" value={expenses.filter((item) => !["paid", "canceled"].includes(item.status)).length} icon={CircleDollarSign} />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Card className="cursor-pointer hover:border-primary/50" onClick={() => navigate("/procurement/requests")}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-primary" /><span className="font-medium">Purchase requests</span></div>
              <ArrowRight className="h-4 w-4" />
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary/50" onClick={() => navigate("/financial-hub/accounting/budgets")}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2"><FileCheck className="h-4 w-4 text-primary" /><span className="font-medium">Budget workspace</span></div>
              <ArrowRight className="h-4 w-4" />
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary/50" onClick={() => navigate("/work-items")}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /><span className="font-medium">Finance work items</span></div>
              <ArrowRight className="h-4 w-4" />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Approval queue</CardTitle>
            <CardDescription>One review queue for submitted expenses, purchases, and budgets.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Request</TableHead><TableHead>Amount</TableHead><TableHead>Submitted</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {!approvalQueue.length ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No approvals are waiting.</TableCell></TableRow>
                ) : approvalQueue.map((item) => (
                  <TableRow key={`${item.kind}-${item.id}`}>
                    <TableCell><Badge variant="outline">{item.kind}</Badge></TableCell>
                    <TableCell>
                      <p className="font-medium">{item.label}</p>
                      {item.workItemId ? <button type="button" className="text-xs text-primary hover:underline" onClick={() => navigate("/work-items")}>Work item linked</button> : null}
                    </TableCell>
                    <TableCell>{money(item.amount)}</TableCell>
                    <TableCell>{item.submittedAt ? new Date(item.submittedAt).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>
                      {access?.can_review ? (
                        <div className="flex gap-1">
                          <Button size="sm" onClick={() => approve(item.kind, item.id)}><Check className="h-4 w-4 mr-1" />Approve</Button>
                          <Button size="sm" variant="destructive" onClick={() => reject(item.kind, item.id)}><X className="h-4 w-4 mr-1" />Reject</Button>
                        </div>
                      ) : <span className="text-xs text-muted-foreground">Finance manager review</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div><CardTitle className="text-base">Expense requests</CardTitle><CardDescription>Draft, submit, approve, and record payment without leaving the hub.</CardDescription></div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild><Button disabled={!access?.can_submit_requests}><Plus className="h-4 w-4 mr-1" />New expense</Button></DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader><DialogTitle>New expense request</DialogTitle></DialogHeader>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label>Payee</Label><Input value={expenseForm.payeeName} onChange={(event) => setExpenseForm((form) => ({ ...form, payeeName: event.target.value }))} /></div>
                  <div className="space-y-2"><Label>Expense date</Label><Input type="date" value={expenseForm.expenseDate} onChange={(event) => setExpenseForm((form) => ({ ...form, expenseDate: event.target.value }))} /></div>
                  <div className="space-y-2"><Label>Amount</Label><Input type="number" min="0.01" step="0.01" value={expenseForm.amount} onChange={(event) => setExpenseForm((form) => ({ ...form, amount: event.target.value }))} /></div>
                  <div className="space-y-2"><Label>Category</Label>
                    <Select value={expenseForm.category} onValueChange={(category) => setExpenseForm((form) => ({ ...form, category }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="operations">Operations</SelectItem><SelectItem value="program">Program</SelectItem><SelectItem value="travel">Travel</SelectItem><SelectItem value="technology">Technology</SelectItem><SelectItem value="professional_services">Professional services</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-2"><Label>NGO / entity</Label>
                    <Select value={expenseForm.ngoId} onValueChange={(ngoId) => setExpenseForm((form) => ({ ...form, ngoId }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="none">HPG operating</SelectItem>{ngos.map((ngo) => <SelectItem key={ngo.id} value={ngo.id}>{ngo.common_name || ngo.legal_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-2"><Label>Business purpose</Label><Textarea value={expenseForm.businessPurpose} onChange={(event) => setExpenseForm((form) => ({ ...form, businessPurpose: event.target.value }))} /></div>
                  <div className="space-y-2 sm:col-span-2"><Label>Description / notes</Label><Textarea value={expenseForm.description} onChange={(event) => setExpenseForm((form) => ({ ...form, description: event.target.value }))} /></div>
                </div>
                <p className="text-xs text-muted-foreground">The approval work item will require evidence; attach the receipt from the Receipts workspace.</p>
                <Button onClick={createExpense} disabled={!expenseForm.payeeName.trim() || !expenseForm.businessPurpose.trim() || Number(expenseForm.amount) <= 0 || saveExpense.isPending}>Save draft</Button>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Request</TableHead><TableHead>Payee / purpose</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {expensesLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading expense requests…</TableCell></TableRow>
                ) : !expenses.length ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No expense requests yet.</TableCell></TableRow>
                ) : expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell><p className="font-mono text-xs">{expense.request_number}</p><p className="text-xs text-muted-foreground">{expense.expense_date}</p></TableCell>
                    <TableCell><p className="font-medium">{expense.payee_name}</p><p className="text-xs text-muted-foreground max-w-xs truncate">{expense.business_purpose}</p></TableCell>
                    <TableCell>{money(Number(expense.amount), expense.currency_code)}</TableCell>
                    <TableCell><Badge variant={statusVariant(expense.status)}>{expense.status.replace(/_/g, " ")}</Badge>{expense.rejected_reason ? <p className="text-xs text-destructive mt-1">{expense.rejected_reason}</p> : null}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {expense.status === "draft" && expense.requester_user_id === user?.id ? <Button size="sm" variant="outline" onClick={() => submitExpense.mutate(expense.id)}><Send className="h-4 w-4 mr-1" />Submit</Button> : null}
                        {expense.status === "approved" && access?.can_review ? <Button size="sm" variant="outline" onClick={() => {
                          const reference = window.prompt("Enter the payment reference.");
                          if (reference?.trim()) markExpensePaid.mutate({ id: expense.id, paymentReference: reference.trim() });
                        }}><CircleDollarSign className="h-4 w-4 mr-1" />Mark paid</Button> : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {access?.is_finance_staff ? (
          <Card>
            <CardHeader><CardTitle className="text-base">Notification outbox</CardTitle><CardDescription>Slack and email events remain visible until a dispatcher marks them sent or failed.</CardDescription></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Channel</TableHead><TableHead>Event</TableHead><TableHead>Recipient</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead></TableRow></TableHeader>
                <TableBody>
                  {!workflowEvents.length ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No workflow notifications yet.</TableCell></TableRow> : workflowEvents.map((event) => (
                    <TableRow key={event.id}><TableCell className="capitalize">{event.notification_type}</TableCell><TableCell>{event.entity_type.replace(/_/g, " ")} · {event.event_type}</TableCell><TableCell>{event.recipient || "—"}</TableCell><TableCell><Badge variant={statusVariant(event.notification_status)}>{event.notification_status}</Badge></TableCell><TableCell>{new Date(event.created_at).toLocaleString()}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </MainLayout>
  );
};

function MetricCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof FileCheck }) {
  return <Card><CardContent className="p-4 flex items-center justify-between"><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-semibold mt-1">{value}</p></div><Icon className="h-5 w-5 text-primary" /></CardContent></Card>;
}

export default FinanceOperationsPage;
