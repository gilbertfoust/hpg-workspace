import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusChip } from "@/components/common/StatusChip";
import { PriorityBadge } from "@/components/common/PriorityBadge";
import { Calendar, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { useWorkItem, useUpdateWorkItem, WorkItemStatus } from "@/hooks/useWorkItems";
import { useProfiles } from "@/hooks/useProfiles";
import { useComments, useCreateComment } from "@/hooks/useComments";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useMemo, useState } from "react";
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

const statusMap: Record<
  string,
  | "approved"
  | "in-progress"
  | "rejected"
  | "draft"
  | "waiting-ngo"
  | "waiting-hpg"
  | "submitted"
  | "under-review"
  | "complete"
  | "canceled"
  | "not-started"
> = {
  Draft: "draft",
  "Not Started": "not-started",
  "In Progress": "in-progress",
  "Waiting on NGO": "waiting-ngo",
  "Waiting on HPG": "waiting-hpg",
  Submitted: "submitted",
  "Under Review": "under-review",
  Approved: "approved",
  Rejected: "rejected",
  Complete: "complete",
  Canceled: "canceled",
};

const statusOptions: WorkItemStatus[] = [
  "Draft",
  "Not Started",
  "In Progress",
  "Waiting on NGO",
  "Waiting on HPG",
  "Submitted",
  "Under Review",
  "Approved",
  "Rejected",
  "Complete",
  "Canceled",
];

export function WorkItemDrawer({ workItemId, open, onOpenChange }: WorkItemDrawerProps) {
  const { data: workItem, isLoading } = useWorkItem(workItemId || "");
  const updateWorkItem = useUpdateWorkItem();
  const { data: profiles } = useProfiles();
  const { user } = useAuth();
  const { data: comments, isLoading: commentsLoading } = useComments(workItemId || "");
  const createComment = useCreateComment();
  const [commentText, setCommentText] = useState("");
  const [formState, setFormState] = useState({
    status: "Draft" as WorkItemStatus,
    owner_user_id: "",
    due_date: "",
  });

  useEffect(() => {
    if (workItem) {
      setFormState({
        status: workItem.status,
        owner_user_id: workItem.owner_user_id || "",
        due_date: workItem.due_date || "",
      });
    }
  }, [workItem]);

  const ownerOptions = useMemo(() => profiles || [], [profiles]);

  const handleSave = async () => {
    if (!workItem) return;
    await updateWorkItem.mutateAsync({
      id: workItem.id,
      status: formState.status,
      owner_user_id: formState.owner_user_id || null,
      due_date: formState.due_date || null,
    });
  };

  const handleAddComment = async () => {
    if (!workItem || !user?.id || !commentText.trim()) return;
    await createComment.mutateAsync({
      work_item_id: workItem.id,
      author_user_id: user.id,
      comment_text: commentText.trim(),
    });
    setCommentText("");
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
              
              <Separator />

              <div className="space-y-4">
                <h4 className="text-sm font-medium">Update Work Item</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <Select
                      value={formState.status}
                      onValueChange={(value) =>
                        setFormState((prev) => ({ ...prev, status: value as WorkItemStatus }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Owner</p>
                    <Select
                      value={formState.owner_user_id || "unassigned"}
                      onValueChange={(value) =>
                        setFormState((prev) => ({
                          ...prev,
                          owner_user_id: value === "unassigned" ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {ownerOptions.map((profile) => (
                          <SelectItem key={profile.id} value={profile.id}>
                            {profile.full_name || profile.email || profile.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Due date</p>
                  <Input
                    type="date"
                    value={formState.due_date}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, due_date: event.target.value }))
                    }
                  />
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={updateWorkItem.isPending}>
                    {updateWorkItem.isPending ? "Saving..." : "Save changes"}
                  </Button>
                </div>
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

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  <h4 className="text-sm font-medium">Comments</h4>
                </div>
                {commentsLoading ? (
                  <Skeleton className="h-16" />
                ) : comments && comments.length > 0 ? (
                  <div className="space-y-3">
                    {comments.map((comment) => (
                      <div key={comment.id} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                          <span>
                            {comment.author?.full_name || comment.author?.email || "Unknown user"}
                          </span>
                          <span>{format(new Date(comment.created_at), "MMM d, yyyy")}</span>
                        </div>
                        <p className="text-sm">{comment.comment_text}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No comments yet.</p>
                )}
                <div className="space-y-2">
                  <Textarea
                    placeholder="Add a comment..."
                    value={commentText}
                    onChange={(event) => setCommentText(event.target.value)}
                    className="min-h-[80px]"
                  />
                  <div className="flex justify-end">
                    <Button
                      onClick={handleAddComment}
                      disabled={createComment.isPending || !commentText.trim()}
                    >
                      {createComment.isPending ? "Adding..." : "Add comment"}
                    </Button>
                  </div>
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
