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
import type { FormSubmissionWithSchema } from "@/hooks/useFormSubmissions";
import { useFormSubmission } from "@/hooks/useFormSubmissions";
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
  const { data: detail } = useFormSubmission(submission?.id || "");
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
    return String(value);
  };

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
