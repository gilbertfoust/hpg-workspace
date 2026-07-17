import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Check, CircleDollarSign, FileCheck2, Loader2, RotateCcw, X } from "lucide-react";
import { useFinanceNgoReview } from "@/hooks/useFinanceNgoReview";

const ngoName = (row: any) => row.ngos?.common_name || row.ngos?.legal_name || "NGO";

export default function FinanceNgoReviewPage() {
  const review = useFinanceNgoReview();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const pendingAccounts = (review.accountRequests.data ?? []).filter((row: any) => row.status === "pending");
  const submittedQuarters = (review.quarterSubmissions.data ?? []).filter((row: any) => ["submitted","under_review","approved"].includes(row.status));

  return (
    <MainLayout title="NGO Finance Review" subtitle="Approve NGO chart-of-account changes and formally review locked quarterly accounting packages.">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Accounts awaiting approval</p><p className="mt-1 text-3xl font-semibold">{pendingAccounts.length}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Quarters awaiting review</p><p className="mt-1 text-3xl font-semibold">{submittedQuarters.length}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Control</p><p className="mt-2 flex items-center gap-2 font-medium"><CircleDollarSign className="h-5 w-5 text-primary" />Finance approval required</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>New account approval queue</CardTitle><CardDescription>An NGO cannot use a requested account until Finance approves and activates it.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {review.accountRequests.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : pendingAccounts.length === 0 ? <p className="text-sm text-muted-foreground">No pending account requests.</p> : pendingAccounts.map((row: any) => (
              <div key={row.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{row.requested_code} — {row.requested_name}</p><p className="text-sm text-muted-foreground">{ngoName(row)} · {row.account_type} · requested by {row.profiles?.full_name || row.profiles?.email || "NGO staff"}</p></div><Badge variant="secondary">pending</Badge></div>
                <p className="text-sm">{row.business_reason}</p>
                <Textarea placeholder="Review notes (required when rejecting)" value={notes[row.id] || ""} onChange={(event) => setNotes({ ...notes, [row.id]: event.target.value })} />
                <div className="flex gap-2"><Button size="sm" disabled={review.reviewAccount.isPending} onClick={() => review.reviewAccount.mutate({ id: row.id, decision: "approved", notes: notes[row.id] })}><Check className="mr-2 h-4 w-4" />Approve and activate</Button><Button size="sm" variant="destructive" disabled={review.reviewAccount.isPending || !notes[row.id]?.trim()} onClick={() => review.reviewAccount.mutate({ id: row.id, decision: "rejected", notes: notes[row.id] })}><X className="mr-2 h-4 w-4" />Reject</Button></div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileCheck2 className="h-5 w-5" />Quarterly submission queue</CardTitle><CardDescription>Submitted quarters are locked until Finance approves them or returns them for changes.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {review.quarterSubmissions.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : submittedQuarters.length === 0 ? <p className="text-sm text-muted-foreground">No quarterly packages are awaiting review.</p> : submittedQuarters.map((row: any) => {
              const readiness = row.readiness_json || {};
              return <div key={row.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{ngoName(row)} · {row.fiscal_year} Q{row.quarter}</p><p className="text-sm text-muted-foreground">Debits {readiness.total_debit ?? 0} · Credits {readiness.total_credit ?? 0} · Missing receipts {readiness.missing_receipts ?? 0}</p></div><Badge>{row.status.replaceAll("_", " ")}</Badge></div>
                <Textarea placeholder="Review notes (required when returning for changes)" value={notes[row.id] || ""} onChange={(event) => setNotes({ ...notes, [row.id]: event.target.value })} />
                <div className="flex flex-wrap gap-2">
                  {row.status === "submitted" && <Button size="sm" variant="outline" onClick={() => review.reviewQuarter.mutate({ id: row.id, decision: "under_review", notes: notes[row.id] })}>Start review</Button>}
                  <Button size="sm" variant="outline" disabled={!notes[row.id]?.trim()} onClick={() => review.reviewQuarter.mutate({ id: row.id, decision: "changes_requested", notes: notes[row.id] })}><RotateCcw className="mr-2 h-4 w-4" />Return for changes</Button>
                  <Button size="sm" onClick={() => review.reviewQuarter.mutate({ id: row.id, decision: row.status === "approved" ? "certified" : "approved", notes: notes[row.id] })}><Check className="mr-2 h-4 w-4" />{row.status === "approved" ? "Certify quarter" : "Approve quarter"}</Button>
                </div>
              </div>;
            })}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
