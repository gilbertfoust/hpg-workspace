import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  MessageSquare,
  FileText,
  Edit,
  Plus,
  Activity,
  ClipboardList,
  CalendarCheck,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useCommentsForNGO } from "@/hooks/useComments";
import { useAuditLogForNGO } from "@/hooks/useAuditLog";
import { useWorkItems } from "@/hooks/useWorkItems";
import { useFormSubmissions } from "@/hooks/useFormSubmissions";

interface NGOActivityTabProps {
  ngoId: string;
}

interface ActivityItem {
  id: string;
  type: "comment" | "audit" | "work-item" | "form-submission";
  created_at: string;
  content: string;
  title?: string;
  actor?: {
    full_name: string | null;
    email: string | null;
  };
  metadata?: {
    action_type?: string;
    entity_type?: string;
  };
}

const actionIcons: Record<string, React.ReactNode> = {
  comment: <MessageSquare className="w-4 h-4 text-primary" />,
  create: <Plus className="w-4 h-4 text-success" />,
  update: <Edit className="w-4 h-4 text-info" />,
  workItem: <ClipboardList className="w-4 h-4 text-primary" />,
  checkIn: <CalendarCheck className="w-4 h-4 text-success" />,
  default: <FileText className="w-4 h-4 text-muted-foreground" />,
};

export function NGOActivityTab({ ngoId }: NGOActivityTabProps) {
  const { data: comments, isLoading: commentsLoading } = useCommentsForNGO(ngoId);
  const { data: auditLogs, isLoading: auditLoading } = useAuditLogForNGO(ngoId);
  const { data: workItems, isLoading: workItemsLoading } = useWorkItems({ ngo_id: ngoId });
  const { data: submissions, isLoading: submissionsLoading } = useFormSubmissions({ ngo_id: ngoId });

  const isLoading = commentsLoading || auditLoading || workItemsLoading || submissionsLoading;

  const checkInWorkItems = (workItems || []).filter(
    (item) => item.type?.toLowerCase() === "monthly ngo check-in",
  );
  const documentRequests = (workItems || []).filter(
    (item) => item.type?.toLowerCase() === "document request",
  );
  const checkInWorkItemIds = new Set(checkInWorkItems.map((item) => item.id));
  const checkInSubmissions = (submissions || []).filter((submission) => {
    if (submission.work_item_id && checkInWorkItemIds.has(submission.work_item_id)) return true;
    return submission.form_template?.name?.toLowerCase().includes("monthly") ?? false;
  });

  // Combine and sort activities
  const activities: ActivityItem[] = [
    ...(comments || []).map(c => ({
      id: `comment-${c.id}`,
      type: "comment" as const,
      created_at: c.created_at,
      content: c.comment_text,
      actor: c.author,
    })),
    ...checkInWorkItems.map((item) => ({
      id: `checkin-work-${item.id}`,
      type: "work-item" as const,
      created_at: item.created_at,
      title: item.title,
      content: "Monthly check-in work item created",
    })),
    ...documentRequests.map((item) => ({
      id: `document-request-${item.id}`,
      type: "work-item" as const,
      created_at: item.created_at,
      title: item.title,
      content: item.description || "Document request created",
    })),
    ...checkInSubmissions.map((submission) => ({
      id: `submission-${submission.id}`,
      type: "form-submission" as const,
      created_at: submission.submitted_at || submission.created_at,
      title: submission.form_template?.name || "Monthly NGO Check-in",
      content: `Form ${submission.submission_status || "draft"}`,
    })),
    ...(auditLogs || []).map(a => ({
      id: `audit-${a.id}`,
      type: "audit" as const,
      created_at: a.created_at,
      content: `${a.action_type} ${a.entity_type}`,
      metadata: {
        action_type: a.action_type,
        entity_type: a.entity_type,
      },
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-32 mb-2" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-medium">Activity Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length > 0 ? (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
            
            <div className="space-y-6">
              {activities.map((activity) => (
                <div key={activity.id} className="flex gap-4 relative">
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center z-10">
                    {activity.type === "comment" 
                      ? actionIcons.comment
                      : activity.type === "form-submission"
                      ? actionIcons.checkIn
                      : activity.type === "work-item"
                      ? actionIcons.workItem
                      : actionIcons[activity.metadata?.action_type || "default"] || actionIcons.default
                    }
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {activity.actor && (
                        <span className="font-medium text-sm">
                          {activity.actor.full_name || activity.actor.email || "Unknown user"}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    
                    {activity.type === "comment" ? (
                      <div className="p-3 rounded-lg bg-muted/50 text-sm">
                        {activity.content}
                      </div>
                    ) : activity.type === "work-item" || activity.type === "form-submission" ? (
                      <div className="space-y-1">
                        {activity.title && <p className="text-sm font-medium">{activity.title}</p>}
                        <p className="text-sm text-muted-foreground">{activity.content}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground capitalize">
                        {activity.content.replace(/_/g, " ")}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No activity yet</h3>
            <p className="text-sm">
              Activity will appear here as work items are created and updated
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
