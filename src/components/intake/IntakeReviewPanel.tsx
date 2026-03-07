import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ExtractionPreviewCard } from "./ExtractionPreviewCard";
import { TransactionAutoBuilder, JournalLine } from "./TransactionAutoBuilder";
import { useAccounts } from "@/hooks/useAccounts";
import { useFiscalPeriods } from "@/hooks/useFiscalPeriods";
import { useIntakeApproval } from "@/hooks/useIntakeApproval";
import { useDocumentExtractionLogs } from "@/hooks/useDocumentExtractionLogs";
import { useDocumentToTransactionLinks } from "@/hooks/useDocumentToTransactionLinks";
import { useDocumentIntake, IntakeSubmission } from "@/hooks/useDocumentIntake";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Loader2, ExternalLink } from "lucide-react";

interface Props {
  submission: IntakeSubmission;
}

export function IntakeReviewPanel({ submission }: Props) {
  const { toast } = useToast();
  const { data: accounts } = useAccounts();
  const { data: periods } = useFiscalPeriods(submission.ngo_id);
  const { data: logs } = useDocumentExtractionLogs(submission.id);
  const { data: links } = useDocumentToTransactionLinks(submission.id);
  const { update } = useDocumentIntake();
  const approval = useIntakeApproval();

  const extracted = (submission.extracted_data_json || {}) as Record<string, unknown>;
  const latestLog = logs?.[0];

  const [description, setDescription] = useState((extracted.description as string) || "");
  const [transactionDate, setTransactionDate] = useState((extracted.date as string) || "");
  const [refNumber, setRefNumber] = useState("");
  const [fiscalPeriodId, setFiscalPeriodId] = useState(submission.fiscal_period_id || "");
  const [reviewerNotes, setReviewerNotes] = useState(submission.reviewer_notes || "");
  const [lines, setLines] = useState<JournalLine[]>([
    { accountId: "", debit: Number(extracted.amount) || 0, credit: 0, memo: "" },
    { accountId: "", debit: 0, credit: Number(extracted.amount) || 0, memo: "" },
  ]);
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  useEffect(() => {
    if (submission.file_path) {
      supabase.storage
        .from("intake-documents")
        .createSignedUrl(submission.file_path, 3600)
        .then(({ data }) => setFileUrl(data?.signedUrl || null));
    }
  }, [submission.file_path]);

  const unlockedPeriods = useMemo(
    () => (periods || []).filter((p) => !(p as any).is_locked),
    [periods]
  );

  const isApproved = submission.status === "approved";
  const isRejected = submission.status === "rejected";
  const canReview = ["pending_review", "extracted"].includes(submission.status);

  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const handleApprove = async () => {
    if (!fiscalPeriodId) {
      toast({ variant: "destructive", title: "Select a fiscal period" });
      return;
    }
    if (!isBalanced) {
      toast({ variant: "destructive", title: "Journal entries must be balanced" });
      return;
    }
    if (lines.some((l) => !l.accountId)) {
      toast({ variant: "destructive", title: "All lines need an account" });
      return;
    }

    try {
      await approval.mutateAsync({
        intakeId: submission.id,
        ngoId: submission.ngo_id,
        fiscalPeriodId,
        description,
        transactionDate: transactionDate || new Date().toISOString().slice(0, 10),
        referenceNumber: refNumber || undefined,
        lines: lines.map((l) => ({
          accountId: l.accountId,
          debit: l.debit,
          credit: l.credit,
          memo: l.memo || undefined,
        })),
        reviewerNotes,
      });
      toast({ title: "Approved!", description: "Transaction created and linked." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Approval failed", description: err.message });
    }
  };

  const handleReject = async () => {
    try {
      await update.mutateAsync({
        id: submission.id,
        status: "rejected",
        reviewer_notes: reviewerNotes,
      });
      toast({ title: "Submission rejected" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: file preview */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Document Preview</CardTitle>
          </CardHeader>
          <CardContent>
            {fileUrl ? (
              <div className="border rounded-lg overflow-hidden">
                {submission.file_name?.match(/\.(png|jpg|jpeg|gif|webp)$/i) ? (
                  <img src={fileUrl} alt="Preview" className="w-full max-h-[500px] object-contain" />
                ) : (
                  <iframe src={fileUrl} className="w-full h-[500px]" title="Document preview" />
                )}
                <div className="p-2 bg-muted/50">
                  <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1">
                    Open in new tab <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No file preview available.</p>
            )}
          </CardContent>
        </Card>

        <ExtractionPreviewCard
          extracted={extracted}
          confidence={latestLog?.confidence_score}
        />

        {isApproved && links && links.length > 0 && (
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">
                Linked to transaction: <strong>{links[0].transaction_id.slice(0, 8)}...</strong>
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right: review form */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Review & Approve</CardTitle>
              <Badge variant={
                isApproved ? "default" : isRejected ? "destructive" : "secondary"
              }>
                {submission.status.replace("_", " ")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Transaction Date</Label>
                <Input
                  type="date"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  disabled={!canReview}
                />
              </div>
              <div>
                <Label>Reference #</Label>
                <Input
                  value={refNumber}
                  onChange={(e) => setRefNumber(e.target.value)}
                  placeholder="Optional"
                  disabled={!canReview}
                />
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!canReview}
              />
            </div>

            <div>
              <Label>Fiscal Period</Label>
              <Select value={fiscalPeriodId} onValueChange={setFiscalPeriodId} disabled={!canReview}>
                <SelectTrigger><SelectValue placeholder="Select period" /></SelectTrigger>
                <SelectContent>
                  {unlockedPeriods.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {canReview && (
              <TransactionAutoBuilder
                accounts={accounts || []}
                lines={lines}
                onChange={setLines}
              />
            )}

            <div>
              <Label>Reviewer Notes</Label>
              <Textarea
                value={reviewerNotes}
                onChange={(e) => setReviewerNotes(e.target.value)}
                placeholder="Add notes..."
                disabled={!canReview}
              />
            </div>

            {canReview && (
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleApprove}
                  disabled={approval.isPending || !isBalanced || !fiscalPeriodId}
                  className="flex-1"
                >
                  {approval.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  Approve & Create Transaction
                </Button>
                <Button variant="destructive" onClick={handleReject} disabled={update.isPending}>
                  <XCircle className="w-4 h-4 mr-2" /> Reject
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
