// src/components/work-items/WorkItemDrawer.tsx
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
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
import { useDocuments } from "@/hooks/useDocuments";
import { useComments, useCreateComment } from "@/hooks/useComments";
import { useWorkItem, useUpdateWorkItem, type WorkItem, type WorkItemStatus, type Priority } from "@/hooks/useWorkItems";
import { useNGO } from "@/hooks/useNGOs";
import { useProfile } from "@/hooks/useProfiles";
import { format } from "date-fns";
import { Loader2, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export type WorkItemDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workItemId?: string | null;
};

// Map WorkItemStatus to StatusChip status format
const mapStatusToChip = (status: WorkItemStatus): Parameters<typeof StatusChip>[0]["status"] => {
  const statusMap: Record<WorkItemStatus, Parameters<typeof StatusChip>[0]["status"]> = {
    draft: "draft",
    not_started: "not-started",
    in_progress: "in-progress",
    waiting_on_ngo: "waiting-ngo",
    waiting_on_hpg: "waiting-hpg",
    submitted: "submitted",
    under_review: "under-review",
    approved: "approved",
    rejected: "rejected",
    complete: "complete",
    canceled: "canceled",
  };
  return statusMap[status] || "draft";
};

// Map Priority to PriorityBadge format
const mapPriorityToBadge = (priority: Priority | null | undefined): "Low" | "Med" | "High" => {
  if (!priority) return "Med";
  const priorityMap: Record<Priority, "Low" | "Med" | "High"> = {
    low: "Low",
    medium: "Med",
    high: "High",
    urgent: "High",
  };
  return priorityMap[priority] || "Med";
};

const statusOptions: { value: WorkItemStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting_on_ngo", label: "Waiting on NGO" },
  { value: "waiting_on_hpg", label: "Waiting on HPG" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under Review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "complete", label: "Complete" },
  { value: "canceled", label: "Canceled" },
];

const priorityOptions: { value: Priority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export const WorkItemDrawer: React.FC<WorkItemDrawerProps> = ({
  open,
  onOpenChange,
  workItemId,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: workItem, isLoading: workItemLoading } = useWorkItem(workItemId);
  const { data: ngo } = useNGO(workItem?.ngo_id || undefined);
  const { data: ownerProfile } = useProfile(workItem?.owner_user_id || "");
  const { data: approverProfile } = useProfile(workItem?.approver_user_id || "");
  const { data: documents } = useDocuments({ work_item_id: workItemId || undefined });
  const { data: comments } = useComments(workItemId || "");
  const updateWorkItem = useUpdateWorkItem();
  const createComment = useCreateComment();

  const [status, setStatus] = useState<WorkItemStatus>("draft");
  const [priority, setPriority] = useState<Priority>("medium");
  const [assignee, setAssignee] = useState<string>("");
  const [commentText, setCommentText] = useState("");

  useEffect(() => {
    if (workItem) {
      setStatus(workItem.status);
      setPriority(workItem.priority || "medium");
      setAssignee(workItem.owner_user_id || "");
    }
  }, [workItem]);

  if (!workItemId) {
    return null;
  }

  if (workItemLoading) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-xl">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  if (!workItem) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-xl">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Work Item Not Found</h2>
            <p className="text-sm text-muted-foreground">
              The requested work item could not be found.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const handleStatusUpdate = async () => {
    try {
      await updateWorkItem.mutateAsync({
        id: workItem.id,
        status,
      });
      toast({
        title: "Status updated",
        description: "Work item status has been updated.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error updating status",
        description: error instanceof Error ? error.message : "Failed to update status",
      });
    }
  };

  const handlePriorityUpdate = async () => {
    try {
      await updateWorkItem.mutateAsync({
        id: workItem.id,
        priority,
      });
      toast({
        title: "Priority updated",
        description: "Work item priority has been updated.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error updating priority",
        description: error instanceof Error ? error.message : "Failed to update priority",
      });
    }
  };

  const handleAssigneeUpdate = async () => {
    try {
      await updateWorkItem.mutateAsync({
        id: workItem.id,
        owner_user_id: assignee || null,
      });
      toast({
        title: "Assignee updated",
        description: "Work item assignee has been updated.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error updating assignee",
        description: error instanceof Error ? error.message : "Failed to update assignee",
      });
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !workItem.id || !user?.id) return;

    try {
      await createComment.mutateAsync({
        work_item_id: workItem.id,
        author_user_id: user.id,
        comment_text: commentText,
      });
      setCommentText("");
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const handleApprove = async () => {
    try {
      await updateWorkItem.mutateAsync({
        id: workItem.id,
        status: "approved",
      });
      toast({
        title: "Work item approved",
        description: "The work item has been approved.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error approving work item",
        description: error instanceof Error ? error.message : "Failed to approve work item",
      });
    }
  };

  const handleReject = async () => {
    try {
      await updateWorkItem.mutateAsync({
        id: workItem.id,
        status: "rejected",
      });
      toast({
        title: "Work item rejected",
        description: "The work item has been rejected.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error rejecting work item",
        description: error instanceof Error ? error.message : "Failed to reject work item",
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2 mb-2">
            <StatusChip status={mapStatusToChip(workItem.status)} />
            {workItem.priority && (
              <PriorityBadge priority={mapPriorityToBadge(workItem.priority)} />
            )}
          </div>
          <SheetTitle>{workItem.title}</SheetTitle>
          {workItem.description && (
            <SheetDescription>{workItem.description}</SheetDescription>
          )}
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Basic Details */}
          <div>
            <h4 className="text-sm font-medium mb-3">Details</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type:</span>
                <span className="font-medium">{workItem.type || "—"}</span>
              </div>
              {workItem.module && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Module:</span>
                  <Badge variant="outline">{workItem.module}</Badge>
                </div>
              )}
              {workItem.due_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Due Date:</span>
                  <span className="font-medium">
                    {format(new Date(workItem.due_date), "MMM d, yyyy")}
                  </span>
                </div>
              )}
              {ownerProfile && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Assigned To:</span>
                  <span className="font-medium">
                    {ownerProfile.full_name || ownerProfile.email || workItem.owner_user_id}
                  </span>
                </div>
              )}
              {ngo && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Related NGO:</span>
                  <a
                    href={`/ngos/${ngo.id}`}
                    className="font-medium text-primary hover:underline flex items-center gap-1"
                    onClick={(e) => {
                      e.preventDefault();
                      window.location.href = `/ngos/${ngo.id}`;
                    }}
                  >
                    {ngo.name}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
              {workItem.evidence_required && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Evidence Status:</span>
                  <Badge variant={workItem.evidence_status === "uploaded" ? "default" : "secondary"}>
                    {workItem.evidence_status || "Not provided"}
                  </Badge>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Status Update */}
          <div className="grid gap-3">
            <Label>Status</Label>
            <div className="flex items-center gap-3">
              <Select value={status} onValueChange={(value) => setStatus(value as WorkItemStatus)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={handleStatusUpdate} disabled={updateWorkItem.isPending}>
                Update Status
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Current: {statusOptions.find((s) => s.value === workItem.status)?.label || workItem.status}</p>
          </div>

          {/* Priority Update */}
          <div className="grid gap-3">
            <Label>Priority</Label>
            <div className="flex items-center gap-3">
              <Select value={priority} onValueChange={(value) => setPriority(value as Priority)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {priorityOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={handlePriorityUpdate} disabled={updateWorkItem.isPending}>
                Update Priority
              </Button>
            </div>
          </div>

          {/* Assignee Update */}
          <div className="grid gap-3">
            <Label>Assignee (User ID)</Label>
            <div className="flex items-center gap-3">
              <Input
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="User ID"
              />
              <Button variant="outline" onClick={handleAssigneeUpdate} disabled={updateWorkItem.isPending}>
                Update Assignee
              </Button>
            </div>
            {ownerProfile && (
              <p className="text-xs text-muted-foreground">
                Current: {ownerProfile.full_name || ownerProfile.email || workItem.owner_user_id}
              </p>
            )}
          </div>

          {/* Approval Workflow */}
          {workItem.approval_required && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-3">Approval</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Approval Required:</span>
                    <Badge variant="outline">Yes</Badge>
                  </div>
                  {approverProfile && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Approver:</span>
                      <span className="font-medium">
                        {approverProfile.full_name || approverProfile.email || workItem.approver_user_id}
                      </span>
                    </div>
                  )}
                  {workItem.status === "under_review" && user?.id === workItem.approver_user_id && (
                    <div className="flex gap-2 mt-3">
                      <Button onClick={handleApprove} disabled={updateWorkItem.isPending}>
                        Approve
                      </Button>
                      <Button variant="destructive" onClick={handleReject} disabled={updateWorkItem.isPending}>
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Evidence/Documents */}
          <div>
            <h4 className="text-sm font-medium mb-3">Evidence & Documents</h4>
            <div className="space-y-2">
              {(documents || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
              ) : (
                documents?.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between text-sm p-2 border rounded">
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

          {/* Comments */}
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
                        {format(new Date(comment.created_at), "MMM d, yyyy 'at' h:mm a")}
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
                onChange={(e) => setCommentText(e.target.value)}
                rows={3}
              />
              <Button onClick={handleAddComment} disabled={!commentText.trim() || createComment.isPending}>
                {createComment.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Comment"
                )}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default WorkItemDrawer;
