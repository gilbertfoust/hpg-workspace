import { useState } from "react";
import { format } from "date-fns";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Check, Landmark, Loader2, Send, ShieldCheck, Upload } from "lucide-react";
import { useWorkspaceNgo } from "@/hooks/useWorkspaceNgo";
import { useFinanceNgoAccounts } from "@/hooks/useFinanceAccounts";
import { useNgoFunding } from "@/hooks/useNgoFunding";
import { useUploadDocument } from "@/hooks/useDocuments";

export default function FinanceNgoFundingPage() {
  const { selectedNgo, selectedNgoId } = useWorkspaceNgo();
  const funding = useNgoFunding(selectedNgoId);
  const { data: accounts = [] } = useFinanceNgoAccounts(selectedNgoId);
  const upload = useUploadDocument();
  const [form, setForm] = useState({ bankConnectionId: "", sourceCashAccountId: "", distributionAccountId: "", amount: "", sourceCurrency: "USD", destinationCurrency: "USD", purpose: "", memo: "" });
  const [recipientRefs, setRecipientRefs] = useState<Record<string,string>>({});
  const [manual, setManual] = useState<Record<string,{ reference: string; file: File | null }>>({});
  const connections = funding.connections.data ?? [];
  const payoutConnections = connections.filter((item: any) => item.status === "verified" && Boolean(item.capabilities?.payouts));
  const cashAccounts = accounts.filter((item: any) => item.account_type === "asset");
  const distributionAccounts = accounts.filter((item: any) => ["expense","asset","liability"].includes(item.account_type));

  if (!selectedNgoId) return <MainLayout title="NGO Funding"><Card><CardContent className="p-8 text-sm text-muted-foreground">Select an NGO in the workspace selector before creating or reviewing funding.</CardContent></Card></MainLayout>;

  const completeManual = async (row: any) => {
    const current = manual[row.id];
    if (!current?.file || !current.reference) return;
    const document = await upload.mutateAsync({ file: current.file, ngoId: selectedNgoId, category: "finance", reviewStatus: "Approved" });
    await funding.completeManual.mutateAsync({ id: row.id, documentId: document.id, reference: current.reference, paidDate: format(new Date(), "yyyy-MM-dd") });
  };

  return (
    <MainLayout title="NGO Funding & International Payouts" subtitle={`${selectedNgo?.common_name || selectedNgo?.legal_name}: controlled releases, bank verification, journal posting, and receipt archive.`}>
      <div className="space-y-6">
        <div className="rounded-lg border bg-card p-4 flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-primary" /><p className="text-sm text-muted-foreground">The requester cannot approve their own funding. Two authorized approvals are required before a payout can be released.</p></div>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Landmark className="h-5 w-5" />Payout account verification</CardTitle><CardDescription>Stripe/Wise/Relay recipients remain unusable until Finance verifies the provider recipient reference.</CardDescription></CardHeader>
          <CardContent className="space-y-3">{connections.length === 0 ? <p className="text-sm text-muted-foreground">The NGO has not started bank onboarding.</p> : connections.map((connection: any) => <div key={connection.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"><div><p className="font-medium">{connection.institution_name || connection.provider.replaceAll("_"," ")}</p><p className="text-xs text-muted-foreground">{connection.country_code} · {connection.currency} · {connection.connection_purpose}</p></div>{connection.status === "verification_required" ? <div className="flex gap-2"><Input className="w-56" placeholder="Provider recipient/account ID" value={recipientRefs[connection.id] || ""} onChange={(event) => setRecipientRefs({ ...recipientRefs, [connection.id]: event.target.value })} /><Button size="sm" disabled={!recipientRefs[connection.id]} onClick={() => funding.verifyConnection.mutate({ id: connection.id, recipientRef: recipientRefs[connection.id] })}>Verify</Button></div> : <Badge variant={connection.status === "verified" ? "default" : "secondary"}>{connection.status}</Badge>}</div>)}</CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Create funding request</CardTitle><CardDescription>Select the destination and the two accounts that will form the balanced journal entry after payment.</CardDescription></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2"><Label>Verified payout destination</Label><Select value={form.bankConnectionId} onValueChange={(value) => setForm({ ...form, bankConnectionId: value })}><SelectTrigger><SelectValue placeholder="Select Stripe, Wise, or Relay destination" /></SelectTrigger><SelectContent>{payoutConnections.map((item: any) => <SelectItem key={item.id} value={item.id}>{item.provider.replaceAll("_"," ")} · {item.country_code} · {item.account_name || item.provider_recipient_ref || "verified"}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Credit source cash account</Label><Select value={form.sourceCashAccountId} onValueChange={(value) => setForm({ ...form, sourceCashAccountId: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{cashAccounts.map((item: any) => <SelectItem key={item.id} value={item.id}>{item.code} — {item.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Debit distribution account</Label><Select value={form.distributionAccountId} onValueChange={(value) => setForm({ ...form, distributionAccountId: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{distributionAccounts.map((item: any) => <SelectItem key={item.id} value={item.id}>{item.code} — {item.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Amount</Label><Input type="number" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2"><div className="space-y-2"><Label>From</Label><Input value={form.sourceCurrency} onChange={(event) => setForm({ ...form, sourceCurrency: event.target.value.toUpperCase() })} /></div><ArrowRight className="mb-2 h-4 w-4" /><div className="space-y-2"><Label>To</Label><Input value={form.destinationCurrency} onChange={(event) => setForm({ ...form, destinationCurrency: event.target.value.toUpperCase() })} /></div></div>
            <div className="space-y-2 md:col-span-2"><Label>Purpose</Label><Textarea value={form.purpose} onChange={(event) => setForm({ ...form, purpose: event.target.value })} /></div>
            <div className="md:col-span-2"><Button disabled={funding.create.isPending || !form.bankConnectionId || !form.sourceCashAccountId || !form.distributionAccountId || !form.amount || !form.purpose} onClick={() => funding.create.mutate(form)}>{funding.create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create approval request</Button></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Funding release queue</CardTitle></CardHeader>
          <CardContent className="space-y-3">{(funding.disbursements.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No funding requests for this NGO.</p> : (funding.disbursements.data ?? []).map((row: any) => {
            const approvalCount = (row.ngo_disbursement_approvals ?? []).filter((approval: any) => approval.decision === "approved").length;
            const connection = connections.find((item: any) => item.id === row.bank_connection_id);
            return <div key={row.id} className="rounded-lg border p-4 space-y-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{row.disbursement_number} · {row.source_currency} {Number(row.amount).toLocaleString(undefined,{minimumFractionDigits:2})}</p><p className="text-sm text-muted-foreground">{row.purpose} · {approvalCount}/{row.required_approvals} approvals</p></div><Badge>{row.status.replaceAll("_"," ")}</Badge></div><div className="flex flex-wrap gap-2">{row.status === "pending_approval" && <><Button size="sm" onClick={() => funding.approve.mutate({ id: row.id, decision: "approved" })}><Check className="mr-2 h-4 w-4" />Approve</Button><Button size="sm" variant="destructive" onClick={() => funding.approve.mutate({ id: row.id, decision: "rejected", notes: "Rejected in funding queue" })}>Reject</Button></>}{row.status === "approved" && <Button size="sm" onClick={() => funding.queue.mutate(row.id)}><Send className="mr-2 h-4 w-4" />Queue payout</Button>}{row.status === "queued" && connection?.provider !== "relay_manual" && <Button size="sm" onClick={() => funding.process.mutate(row.id)}><Send className="mr-2 h-4 w-4" />Send through provider</Button>}</div>{(row.status === "processing" || (row.status === "queued" && connection?.provider === "relay_manual")) && <div className="grid gap-3 rounded-md bg-muted/30 p-3 md:grid-cols-[1fr_1fr_auto]"><Input placeholder="Final provider/wire reference" value={manual[row.id]?.reference || ""} onChange={(event) => setManual({ ...manual, [row.id]: { reference: event.target.value, file: manual[row.id]?.file || null } })} /><Input type="file" accept="application/pdf,image/*" onChange={(event) => setManual({ ...manual, [row.id]: { reference: manual[row.id]?.reference || "", file: event.target.files?.[0] || null } })} /><Button disabled={!manual[row.id]?.reference || !manual[row.id]?.file || upload.isPending} onClick={() => completeManual(row)}><Upload className="mr-2 h-4 w-4" />Verify, archive & post</Button></div>}</div>;
          })}</CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
