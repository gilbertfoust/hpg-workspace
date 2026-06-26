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
import { FileDown, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { FormSubmissionWithSchema } from "@/hooks/useFormSubmissions";
import { useFormSubmission } from "@/hooks/useFormSubmissions";
import type { FormSubmission } from "@/hooks/useFormSubmissions";
import { exportFormSubmissionToPdf } from "@/lib/pdf/formToPdf";
import { downloadPdfBytes } from "@/lib/pdf/pdfDocument";

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
  const [exporting, setExporting] = useState(false);

  const fields = (sub as FormSubmissionWithSchema)?.form_template?.schema_json?.fields || [];
  const payload =
    sub?.payload_json && typeof sub.payload_json === "object"
      ? (sub.payload_json as Record<string, unknown>)
      : null;

  const renderValue = (value: unknown): string => {
    if (value === null || value === undefined) return "—";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "string" && value.startsWith("data:image")) return "[Signature]";
    return String(value);
  };

  const handleExportPdf = async () => {
    if (!sub?.form_template || !payload) return;
    setExporting(true);
    try {
      const bytes = await exportFormSubmissionToPdf(
        sub.form_template.name,
        fields,
        payload,
        {
          submittedAt: sub.submitted_at
            ? format(new Date(sub.submitted_at), "MMM d, yyyy h:mm a")
            : undefined,
        }
      );
      const safeName = sub.form_template.name.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase();
      await downloadPdfBytes(bytes, `${safeName}-submission.pdf`);
      toast.success("PDF exported");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
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
          {payload && fields.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exporting}>
              {exporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4 mr-2" />
              )}
              Export PDF
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
