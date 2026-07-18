import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import type { FormSubmissionWithSchema } from "@/hooks/useFormSubmissions";
import { useFormSubmission, useReviewFormSubmission } from "@/hooks/useFormSubmissions";
import type { FormSubmission } from "@/hooks/useFormSubmissions";
import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { isStaffWorkspaceRole, useUserRole } from "@/hooks/useUserRole";

interface FormSubmissionDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submission: FormSubmission | null;
  submittedByLabel?: string;
}

export function FormSubmissionDetailSheet({
  open,
  onOpenChange,
  submission,
  submittedByLabel,
}: FormSubmissionDetailSheetProps) {
  const { data: detail } = useFormSubmission(submission?.id || "");
  const reviewSubmission = useReviewFormSubmission();
  const { data: userRole } = useUserRole();
  const [reviewNotes, setReviewNotes] = useState("");
  const sub = detail || submission;

  const fields = (sub as FormSubmissionWithSchema)?.form_template?.schema_json?.fields || [];
  const payload =
    sub?.payload_json && typeof sub.payload_json === "object"
      ? (sub.payload_json as Record<string, unknown>)
      : null;

  const renderValue = (value: unknown): string => {
    if (value === null || value === undefined) return "—";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "object") {
      const fileValue = value as { document_id?: string; name?: string };
      if (fileValue.document_id) return fileValue.name || "Attached file";
      return JSON.stringify(value);
    }
    return String(value);
  };

  const canReview = sub?.submission_status === 'submitted' && isStaffWorkspaceRole(userRole?.role);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{sub?.form_template?.name || "Submission"}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            {sub?.submission_status && (
              <Badge variant="outline" className="capitalize">
                {sub.submission_status}
              </Badge>
            )}
            {sub?.submitted_at && (
              <span className="text-xs text-muted-foreground">
                Submitted {format(new Date(sub.submitted_at), "MMM d, yyyy")}
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        <Separator className="my-4" />

        <div className="space-y-3 text-sm">
          {submittedByLabel && (
            <p>
              <span className="font-medium">Submitted by:</span> {submittedByLabel}
            </p>
          )}
          {sub?.work_item_id && (
            <Button asChild variant="outline" size="sm">
              <Link to={`/work-items?workItemId=${sub.work_item_id}`}>
                View Work Item
              </Link>
            </Button>
          )}
        </div>

        <Separator className="my-4" />

        {canReview && sub && (
          <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <p className="text-sm font-medium">Department review</p>
            <Textarea value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} placeholder="Review notes or requested corrections" rows={3} />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => reviewSubmission.mutate({ id: sub.id, decision: 'accepted', notes: reviewNotes })} disabled={reviewSubmission.isPending}>
                <CheckCircle2 className="mr-2 h-4 w-4" />Accept
              </Button>
              <Button size="sm" variant="destructive" onClick={() => reviewSubmission.mutate({ id: sub.id, decision: 'rejected', notes: reviewNotes })} disabled={reviewSubmission.isPending}>
                <XCircle className="mr-2 h-4 w-4" />Request revision
              </Button>
            </div>
          </div>
        )}

        {sub?.review_notes && (
          <div className="rounded-lg border p-3 text-sm"><span className="font-medium">Review notes:</span> {sub.review_notes}</div>
        )}

        {(canReview || sub?.review_notes) && <Separator className="my-4" />}

        <ScrollArea className="h-[calc(100vh-260px)] pr-4">
          {payload && fields.length > 0 ? (
            <div className="space-y-4">
              {fields.map((field) => (
                <div key={field.name} className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    {field.label}
                  </p>
                  <p className="text-sm">{renderValue(payload[field.name])}</p>
                </div>
              ))}
            </div>
          ) : payload ? (
            <div className="space-y-4">
              {Object.entries(payload).map(([key, value]) => (
                <div key={key} className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    {key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                  </p>
                  <p className="text-sm">{renderValue(value)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No payload recorded.
            </p>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
