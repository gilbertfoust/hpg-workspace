import { useMemo } from "react";
import { format, parseISO, isSameMonth } from "date-fns";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useProgramActivities } from "@/hooks/useProgramActivities";
import { useDocuments } from "@/hooks/useDocuments";

interface ProgramEvidencePackDrawerProps {
  ngoId: string | null;
  ngoName: string | null;
  month: number;
  year: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProgramEvidencePackDrawer({ ngoId, ngoName, month, year, open, onOpenChange }: ProgramEvidencePackDrawerProps) {
  const startDate = new Date(year, month - 1, 1).toISOString();
  const endDate = new Date(year, month, 0).toISOString();

  const { data: activities } = useProgramActivities({
    ngo_id: ngoId || undefined,
    startDate,
    endDate,
  });

  const { data: documents } = useDocuments(ngoId ? { ngo_id: ngoId, category: "program" } : undefined);

  const filteredDocuments = useMemo(() => {
    if (!documents) return [];
    return documents.filter((doc) => {
      const uploadedDate = parseISO(doc.uploaded_at);
      return isSameMonth(uploadedDate, new Date(year, month - 1, 1));
    });
  }, [documents, month, year]);

  const monthLabel = format(new Date(year, month - 1, 1), "LLLL yyyy");

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[95vh]">
        <DrawerHeader>
          <DrawerTitle>Evidence Pack</DrawerTitle>
          <DrawerDescription>
            {ngoName ? `${ngoName} • ${monthLabel}` : monthLabel}
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-6 pb-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Program Activities</CardTitle>
            </CardHeader>
            <CardContent>
              {!activities || activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activities recorded for this period.</p>
              ) : (
                <ul className="space-y-3">
                  {activities.map((activity) => (
                    <li key={activity.id} className="flex flex-col gap-1 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{activity.title}</span>
                        <Badge variant="outline">{activity.status || "Pending"}</Badge>
                      </div>
                      <div className="text-muted-foreground">
                        {activity.activity_type || "Activity"} • {format(parseISO(activity.activity_date), "PPP")}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Documents & Evidence</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredDocuments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No documents uploaded for this period.</p>
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
        </div>

        <DrawerFooter className="px-6 pb-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
