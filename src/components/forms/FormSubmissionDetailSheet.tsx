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
import { format } from "date-fns";
import { Link } from "react-router-dom";
import type { FormSubmission } from "@/hooks/useFormSubmissions";

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
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{submission?.form_template?.name || "Submission"}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            {submission?.submission_status && (
              <Badge variant="outline" className="capitalize">
                {submission.submission_status}
              </Badge>
            )}
            {submission?.submitted_at && (
              <span className="text-xs text-muted-foreground">
                Submitted {format(new Date(submission.submitted_at), "MMM d, yyyy")}
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

        <ScrollArea className="h-[calc(100vh-260px)] pr-4">
          <pre className="text-xs bg-muted rounded-lg p-4 overflow-x-auto">
            {submission?.payload_json
              ? JSON.stringify(submission.payload_json, null, 2)
              : "No payload recorded."}
          </pre>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
