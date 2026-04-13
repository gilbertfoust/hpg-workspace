import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { useFormSubmission } from "@/hooks/useFormSubmissions";
import { Loader2 } from "lucide-react";

interface FormSubmissionDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionId: string | null;
  submittedByLabel?: string;
}

const statusColors: Record<string, string> = {
  submitted: "bg-green-500/10 text-green-700",
  draft: "bg-amber-500/10 text-amber-700",
  accepted: "bg-blue-500/10 text-blue-700",
  rejected: "bg-destructive/10 text-destructive",
};

export function FormSubmissionDetailSheet({
  open,
  onOpenChange,
  submissionId,
  submittedByLabel,
}: FormSubmissionDetailSheetProps) {
  const { data: submission, isLoading } = useFormSubmission(submissionId || "");

  const fields = submission?.form_template?.schema_json?.fields || [];
  const payload = (submission?.payload_json && typeof submission.payload_json === "object"
    ? submission.payload_json
    : {}) as Record<string, unknown>;

  const renderValue = (value: unknown): string => {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "—";
    return String(value);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{submission?.form_template?.name || "Submission"}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            {submission?.submission_status && (
              <Badge className={statusColors[submission.submission_status] || "bg-muted text-muted-foreground"}>
                {submission.submission_status}
              </Badge>
            )}
            {submission?.submitted_at && (
              <span className="text-xs text-muted-foreground">
                Submitted {format(new Date(submission.submitted_at), "MMM d, yyyy 'at' h:mm a")}
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
          {submission?.work_item_id && (
            <Button asChild variant="outline" size="sm">
              <Link to={`/work-items?workItemId=${submission.work_item_id}`}>
                View Work Item
              </Link>
            </Button>
          )}
        </div>

        <Separator className="my-4" />

        <ScrollArea className="h-[calc(100vh-300px)] pr-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : fields.length > 0 ? (
            <div className="space-y-4">
              {fields.map((field) => (
                <div key={field.name} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{field.label}</Label>
                  <p className="text-sm">{renderValue(payload[field.name])}</p>
                </div>
              ))}
            </div>
          ) : (
            <pre className="text-xs bg-muted rounded-lg p-4 overflow-x-auto">
              {JSON.stringify(payload, null, 2)}
            </pre>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
