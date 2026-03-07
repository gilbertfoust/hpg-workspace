import { useMemo } from "react";
import { format, parseISO, isSameMonth } from "date-fns";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDocuments } from "@/hooks/useDocuments";
import { useWorkItems, useCreateWorkItem } from "@/hooks/useWorkItems";
import type { ProgramActivity } from "@/hooks/useProgramActivities";

interface ProgramActivityDrawerProps {
  activity: ProgramActivity | null;
  ngoName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProgramActivityDrawer({ activity, ngoName, open, onOpenChange }: ProgramActivityDrawerProps) {
  const { mutateAsync: createWorkItem, isPending } = useCreateWorkItem();
  const activityDate = activity?.activity_date ? parseISO(activity.activity_date) : null;

  const { data: documents } = useDocuments(
    activity?.work_item_id
      ? { work_item_id: activity.work_item_id }
      : activity?.ngo_id
        ? { ngo_id: activity.ngo_id, category: "program" }
        : undefined
  );

  const { data: workItems } = useWorkItems({
    module: "program",
    ngo_id: activity?.ngo_id || undefined,
  });

  const filteredDocuments = useMemo(() => {
    if (!activityDate) return documents || [];
    return (documents || []).filter((doc) => isSameMonth(parseISO(doc.uploaded_at), activityDate));
  }, [activityDate, documents]);

  const linkedWorkItems = useMemo(() => {
    if (!activityDate) return workItems || [];
    return (workItems || []).filter((item) => {
      if (!item.created_at) return false;
      return isSameMonth(parseISO(item.created_at), activityDate);
    });
  }, [activityDate, workItems]);

  const handleCreateWorkItem = async (type: "Follow-up engagement" | "Reporting task") => {
    if (!activity) return;

    await createWorkItem({
      module: "program",
      ngo_id: activity.ngo_id || undefined,
      type,
      title: `${type}: ${activity.title}`,
      description: `Created from program activity on ${activity.activity_date}.`,
      priority: type === "Follow-up engagement" ? "medium" : "low",
    });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[95vh]">
        <DrawerHeader>
          <DrawerTitle>{activity?.title || "Program activity"}</DrawerTitle>
          <DrawerDescription>{ngoName || ""}</DrawerDescription>
        </DrawerHeader>

        <div className="px-6 pb-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date</span>
                <span>{activityDate ? format(activityDate, "PPP") : "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span>{activity?.activity_type || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Participants</span>
                <span>{activity?.participants_count ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Location</span>
                <span>{activity?.location || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant="outline">{activity?.status || "Pending"}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Linked Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {filteredDocuments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No documents linked to this activity.</p>
              ) : (
                <ul className="space-y-2">
                  {filteredDocuments.map((doc) => (
                    <li key={doc.id} className="flex items-center justify-between text-sm">
                      <a className="text-primary hover:underline" href={doc.file_path} target="_blank" rel="noreferrer">
                        {doc.file_name}
                      </a>
                      <span className="text-muted-foreground">{format(parseISO(doc.uploaded_at), "PPP")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Linked Work Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {linkedWorkItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">No work items linked to this activity.</p>
              ) : (
                <ul className="space-y-2">
                  {linkedWorkItems.map((item) => (
                    <li key={item.id} className="flex items-center justify-between text-sm">
                      <span>{item.title}</span>
                      <Badge variant="secondary">{item.status.replace(/_/g, " ")}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <DrawerFooter className="px-6 pb-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button variant="secondary" onClick={() => handleCreateWorkItem("Reporting task")} disabled={isPending || !activity}>
            Create reporting task
          </Button>
          <Button onClick={() => handleCreateWorkItem("Follow-up engagement")} disabled={isPending || !activity}>
            Create follow-up engagement
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
