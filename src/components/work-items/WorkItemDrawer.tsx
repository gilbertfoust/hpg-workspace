import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/common/StatusChip";
import { PriorityBadge } from "@/components/common/PriorityBadge";
import { Calendar, User, Building2 } from "lucide-react";
import { format } from "date-fns";
import { useWorkItem } from "@/hooks/useWorkItems";

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

export function WorkItemDrawer({ workItemId, open, onOpenChange }: WorkItemDrawerProps) {
  const { data: workItem, isLoading } = useWorkItem(workItemId || "");

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
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
