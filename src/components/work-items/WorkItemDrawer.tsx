import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/common/StatusChip";
import { PriorityBadge } from "@/components/common/PriorityBadge";
import { Calendar, CheckCircle2, Download, Eye, FileText, File, FileSpreadsheet, FileImage, Upload, XCircle } from "lucide-react";
import { format } from "date-fns";
import { useWorkItem, useUpdateWorkItem, WorkItem } from "@/hooks/useWorkItems";
import { useDocuments, useDocumentUrl, useUpdateDocument, Document } from "@/hooks/useDocuments";
import { DocumentUploadDialog } from "@/components/ngo/DocumentUploadDialog";
import { useState } from "react";
import { Calendar, BellPlus } from "lucide-react";
import { format } from "date-fns";
import { useWorkItem } from "@/hooks/useWorkItems";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateReminder } from "@/hooks/useReminders";
import { getRelativeReminderAt } from "@/lib/reminders";

interface WorkItemDrawerProps {
  workItemId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusMap: Record<string, "approved" | "in-progress" | "rejected" | "draft" | "waiting-ngo"> = {
  draft: "draft",
  not_started: "draft",
  in_progress: "in-progress",
  waiting_on_ngo: "waiting-ngo",
  complete: "approved",
  canceled: "draft",
};

const reviewStatusStyles: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function getFileIcon(fileType: string | null) {
  if (!fileType) return <File className="w-4 h-4 text-muted-foreground" />;
  
  if (fileType.includes("pdf")) return <FileText className="w-4 h-4 text-red-500" />;
  if (fileType.includes("spreadsheet") || fileType.includes("excel") || fileType.includes("csv")) {
    return <FileSpreadsheet className="w-4 h-4 text-green-500" />;
  }
  if (fileType.includes("image")) return <FileImage className="w-4 h-4 text-blue-500" />;
  if (fileType.includes("word") || fileType.includes("document")) {
    return <FileText className="w-4 h-4 text-blue-600" />;
  }
  
  return <File className="w-4 h-4 text-muted-foreground" />;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function EvidenceSection({ workItem }: { workItem: WorkItem }) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const { data: documents, isLoading } = useDocuments({ work_item_id: workItem.id });
  const { downloadDocument, previewDocument } = useDocumentUrl();
  const updateDocument = useUpdateDocument();
  const updateWorkItem = useUpdateWorkItem();

  const handleReviewUpdate = async (doc: Document, status: "approved" | "rejected") => {
    await updateDocument.mutateAsync({ id: doc.id, review_status: status });
    await updateWorkItem.mutateAsync({ id: workItem.id, evidence_status: status });
  };

  const canMarkComplete =
    workItem.evidence_status === "approved" && !["complete", "canceled"].includes(workItem.status);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h4 className="text-sm font-medium">Evidence</h4>
          <p className="text-xs text-muted-foreground">
            Evidence status: <span className="capitalize">{workItem.evidence_status}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canMarkComplete && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateWorkItem.mutate({ id: workItem.id, status: "complete" })}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Mark Complete
            </Button>
          )}
          <Button size="sm" onClick={() => setUploadDialogOpen(true)} disabled={!workItem.ngo_id}>
            <Upload className="w-4 h-4 mr-2" />
            Upload Evidence
          </Button>
        </div>
      </div>

      {!workItem.ngo_id && (
        <p className="text-xs text-muted-foreground">
          Evidence uploads require an NGO to be linked to this work item.
        </p>
      )}

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      )}

      {!isLoading && (documents || []).length === 0 && (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No evidence documents uploaded yet.
        </div>
      )}

      {!isLoading && (documents || []).length > 0 && (
        <div className="space-y-3">
          {(documents || []).map((doc) => (
            <div key={doc.id} className="flex flex-col gap-3 rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-1">{getFileIcon(doc.file_type)}</div>
                  <div>
                    <p className="text-sm font-medium">{doc.file_name}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatFileSize(doc.file_size)}</span>
                      <span>•</span>
                      <span>{format(new Date(doc.uploaded_at), "MMM d, yyyy")}</span>
                      {doc.review_status && (
                        <>
                          <span>•</span>
                          <Badge className={`text-xs ${reviewStatusStyles[doc.review_status] || ""}`}>
                            {doc.review_status}
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => previewDocument(doc.file_path)}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => downloadDocument(doc.file_path, doc.file_name)}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleReviewUpdate(doc, "approved")}
                  disabled={updateDocument.isPending}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleReviewUpdate(doc, "rejected")}
                  disabled={updateDocument.isPending}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <DocumentUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        ngoId={workItem.ngo_id || ""}
        workItemId={workItem.id}
      />
    </div>
  );
}

export function WorkItemDrawer({ workItemId, open, onOpenChange }: WorkItemDrawerProps) {
  const { data: workItem, isLoading } = useWorkItem(workItemId || "");
  const createReminder = useCreateReminder();
  const [customReminderAt, setCustomReminderAt] = useState("");

  const scheduleQuickReminder = async (daysFromNow: number) => {
    if (!workItem) return;
    await createReminder.mutateAsync({
      workItemId: workItem.id,
      remindAt: getRelativeReminderAt(daysFromNow),
    });
  };

  const scheduleCustomReminder = async () => {
    if (!workItem || !customReminderAt) return;
    await createReminder.mutateAsync({
      workItemId: workItem.id,
      remindAt: new Date(customReminderAt).toISOString(),
    });
    setCustomReminderAt("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-24" />
          </div>
        )}
        
        {workItem && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2 mb-2">
                <StatusChip status={statusMap[workItem.status] || "draft"} />
                <PriorityBadge priority={workItem.priority} />
              </div>
              <SheetTitle>{workItem.title}</SheetTitle>
            </SheetHeader>
            
            <div className="mt-6 space-y-6">
              {workItem.description && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Description</h4>
                  <p className="text-sm text-muted-foreground">{workItem.description}</p>
                </div>
              )}
              
              <Separator />
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">Module</p>
                  <Badge variant="outline" className="capitalize">
                    {workItem.module.replace(/_/g, " ")}
                  </Badge>
                </div>
                {workItem.due_date && (
                  <div>
                    <p className="text-muted-foreground mb-1">Due Date</p>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(workItem.due_date), "MMM d, yyyy")}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">Created</p>
                  <p>{format(new Date(workItem.created_at), "MMM d, yyyy")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Updated</p>
                  <p>{format(new Date(workItem.updated_at), "MMM d, yyyy")}</p>
                </div>
              </div>

              {workItem.evidence_required && (
                <>
                  <Separator />
                  <EvidenceSection workItem={workItem} />
                </>
              )}
              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Reminders</h4>
                  <BellPlus className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Schedule in-app reminders for this work item.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => scheduleQuickReminder(1)}
                    disabled={createReminder.isPending}
                  >
                    Tomorrow
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => scheduleQuickReminder(3)}
                    disabled={createReminder.isPending}
                  >
                    In 3 days
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => scheduleQuickReminder(7)}
                    disabled={createReminder.isPending}
                  >
                    Next week
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="datetime-local"
                    value={customReminderAt}
                    onChange={(event) => setCustomReminderAt(event.target.value)}
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={scheduleCustomReminder}
                    disabled={!customReminderAt || createReminder.isPending}
                  >
                    Set
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
