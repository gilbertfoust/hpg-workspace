import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useWorkItems } from "@/hooks/useWorkItems";
import { PartnershipWorkItemDialog } from "./PartnershipWorkItemDialog";
import type { PartnershipPipelineItem } from "./types";
import { format } from "date-fns";

interface PartnershipRecordDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PartnershipPipelineItem | null;
}

export function PartnershipRecordDrawer({ open, onOpenChange, item }: PartnershipRecordDrawerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState("New follow-up");

  const workItemType = useMemo(() => {
    if (!item) return "";
    return `partnership:${item.record.id}`;
  }, [item]);

  const { data: workItems } = useWorkItems(
    item
      ? {
          module: "partnership",
          type: workItemType,
        }
      : undefined,
  );

  if (!item) return null;

  const formatDate = (value?: string | null) => {
    if (!value) return "—";
    return format(new Date(value), "MMM d, yyyy");
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex flex-col gap-2">
              <span>{item.partnerName}</span>
              <span className="text-sm font-normal text-muted-foreground">{item.partnerType || "Partner"}</span>
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <div className="flex flex-wrap gap-2">
              <Badge>{item.stage}</Badge>
              {item.region && <Badge variant="outline">{item.region}</Badge>}
              {item.status && <Badge variant="secondary">{item.status}</Badge>}
              {item.ngoName && <Badge variant="outline">{item.ngoName}</Badge>}
              {item.ngoBundle && <Badge variant="secondary">{item.ngoBundle}</Badge>}
            </div>

            {item.primaryContact && (
              <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-sm">
                <p className="text-muted-foreground">Primary contact</p>
                <p className="mt-2">{item.primaryContact}</p>
              </div>
            )}

            {item.keyCommitments && (
              <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-sm">
                <p className="text-muted-foreground">Key commitments</p>
                <p className="mt-2">{item.keyCommitments}</p>
              </div>
            )}

            {item.notes && (
              <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-sm">
                <p className="text-muted-foreground">Notes</p>
                <p className="mt-2">{item.notes}</p>
              </div>
            )}

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Linked work items</h3>
                  <p className="text-xs text-muted-foreground">
                    Follow-ups, meetings, and MOU review tasks.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setDialogTitle(`Follow up: ${item.partnerName}`);
                    setDialogOpen(true);
                  }}
                >
                  Create work item
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Schedule meeting", title: `Meeting: ${item.partnerName}` },
                  { label: "MOU review", title: `MOU review: ${item.partnerName}` },
                  { label: "Follow-up notes", title: `Notes: ${item.partnerName}` },
                ].map((quick) => (
                  <Button
                    key={quick.label}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDialogTitle(quick.title);
                      setDialogOpen(true);
                    }}
                  >
                    {quick.label}
                  </Button>
                ))}
              </div>

              {workItems && workItems.length > 0 ? (
                <div className="space-y-3">
                  {workItems.map((workItem) => (
                    <div key={workItem.id} className="rounded-lg border border-border/60 p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{workItem.title}</p>
                        <Badge variant="secondary" className="capitalize">
                          {workItem.status.replace("_", " ")}
                        </Badge>
                      </div>
                      {workItem.due_date && (
                        <p className="mt-1 text-xs text-muted-foreground">Due {formatDate(workItem.due_date)}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-muted-foreground/40 p-4 text-sm text-muted-foreground">
                  No work items linked yet.
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <PartnershipWorkItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultTitle={dialogTitle}
        workItemType={workItemType}
        ngoId={item.record.ngo_id || undefined}
        module="partnership"
      />
    </>
  );
}
