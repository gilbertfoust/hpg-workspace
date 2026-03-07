import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusChip } from "@/components/common/StatusChip";
import { PriorityBadge } from "@/components/common/PriorityBadge";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments, useCreateDocument } from "@/hooks/useDocuments";
import { useComments, useCreateComment } from "@/hooks/useComments";
import { useUpdateWorkItem } from "@/hooks/useWorkItems";
import { useUpdateITAccessRequest, type AccessRequest } from "@/hooks/useITAccessRequests";
import type { WorkItem } from "@/hooks/useWorkItems";
import { accessRequestStatusOptions, getStatusLabel, statusChipMap } from "@/components/it/itUtils";
import { mapITStatusToWorkItemStatus, type ITStatus } from "@/hooks/useITStatus";
import { format } from "date-fns";

interface AccessRequestDrawerProps {
  accessRequest: AccessRequest | null;
  workItem?: WorkItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccessRequestDrawer({ accessRequest, workItem, open, onOpenChange }: AccessRequestDrawerProps) {
  const { user } = useAuth();
  const updateAccessRequest = useUpdateITAccessRequest();
  const updateWorkItem = useUpdateWorkItem();
  const createDocument = useCreateDocument();
  const createComment = useCreateComment();
  const { data: documents } = useDocuments({ work_item_id: accessRequest?.work_item_id || undefined });
  const { data: comments } = useComments(accessRequest?.work_item_id || "");

  const [status, setStatus] = useState<ITStatus>(accessRequest?.status || "submitted");
  const [commentText, setCommentText] = useState("");
  const [evidence, setEvidence] = useState({
    file_name: "",
    file_path: "",
    file_type: "",
  });

  useEffect(() => {
    if (accessRequest) {
      setStatus(accessRequest.status);
    }
  }, [accessRequest]);

  if (!accessRequest) {
    return null;
  }

  const handleStatusUpdate = async () => {
    await updateAccessRequest.mutateAsync({ id: accessRequest.id, status });
    if (workItem) {
      await updateWorkItem.mutateAsync({
        id: workItem.id,
        status: mapITStatusToWorkItemStatus(status),
      });
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !accessRequest.work_item_id || !user?.id) return;

    await createComment.mutateAsync({
      work_item_id: accessRequest.work_item_id,
      author_user_id: user.id,
      comment_text: commentText,
    });

    setCommentText("");
  };

  const handleAddEvidence = async () => {
    if (!evidence.file_name.trim() || !evidence.file_path.trim() || !accessRequest.work_item_id) return;

    await createDocument.mutateAsync({
      file_name: evidence.file_name,
      file_path: evidence.file_path,
      file_type: evidence.file_type || undefined,
      category: "it",
      work_item_id: accessRequest.work_item_id,
      uploaded_by_user_id: user?.id,
    });

    setEvidence({ file_name: "", file_path: "", file_type: "" });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2 mb-2">
            <StatusChip status={statusChipMap[accessRequest.status]} />
            <PriorityBadge priority={workItem?.priority || accessRequest.priority} />
          </div>
          <SheetTitle>Access Request: {accessRequest.request_type}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div>
            <h4 className="text-sm font-medium mb-2">Details</h4>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>Target user: {accessRequest.target_user}</p>
              <p>Requested by: {accessRequest.requested_by_user_id}</p>
            </div>
            <p className="mt-3 text-sm">{accessRequest.justification}</p>
          </div>

          <Separator />

          <div className="grid gap-3">
            <Label>Status</Label>
            <div className="flex items-center gap-3">
              <Select value={status} onValueChange={(value) => setStatus(value as ITStatus)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {accessRequestStatusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={handleStatusUpdate}>
                Update Status
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Current: {getStatusLabel(accessRequest.status)}</p>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-medium mb-3">Evidence</h4>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="File name"
                  value={evidence.file_name}
                  onChange={(event) =>
                    setEvidence((prev) => ({ ...prev, file_name: event.target.value }))
                  }
                />
                <Input
                  placeholder="File type"
                  value={evidence.file_type}
                  onChange={(event) =>
                    setEvidence((prev) => ({ ...prev, file_type: event.target.value }))
                  }
                />
              </div>
              <Input
                placeholder="Evidence link or path"
                value={evidence.file_path}
                onChange={(event) =>
                  setEvidence((prev) => ({ ...prev, file_path: event.target.value }))
                }
              />
              <Button variant="secondary" onClick={handleAddEvidence}>
                Upload Evidence
              </Button>
            </div>
            <div className="mt-4 space-y-2">
              {(documents || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No evidence uploaded yet.</p>
              ) : (
                documents?.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{doc.file_name}</p>
                      <p className="text-xs text-muted-foreground">{doc.file_path}</p>
                    </div>
                    <Badge variant="outline">{format(new Date(doc.uploaded_at), "MMM d, yyyy")}</Badge>
                  </div>
                ))
              )}
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-medium mb-2">Comments</h4>
            <div className="space-y-3">
              {(comments || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No comments yet.</p>
              ) : (
                comments?.map((comment) => (
                  <div key={comment.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">
                        {comment.author?.full_name || comment.author?.email || comment.author_user_id}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(comment.created_at), "MMM d, yyyy")}
                      </span>
                    </div>
                    <p className="text-muted-foreground">{comment.comment_text}</p>
                  </div>
                ))
              )}
            </div>
            <div className="mt-3 space-y-2">
              <Textarea
                placeholder="Add a comment"
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                rows={3}
              />
              <Button onClick={handleAddComment}>Add Comment</Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
