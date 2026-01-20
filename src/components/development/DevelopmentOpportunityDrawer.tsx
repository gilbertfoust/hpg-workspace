import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { useWorkItems } from "@/hooks/useWorkItems";
import { DevelopmentWorkItemDialog } from "./DevelopmentWorkItemDialog";
import type { DevelopmentPipelineItem } from "./types";

interface DevelopmentOpportunityDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: DevelopmentPipelineItem | null;
}

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  return format(new Date(value), "MMM d, yyyy");
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function DevelopmentOpportunityDrawer({ open, onOpenChange, item }: DevelopmentOpportunityDrawerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState("New work item");

  const workItemType = useMemo(() => {
    if (!item) return "";
    if (item.proposal?.id) {
      return `proposal:${item.proposal.id}`;
    }
    if (item.opportunity?.id) {
      return `opportunity:${item.opportunity.id}`;
    }
    return "";
  }, [item]);

  const { data: workItems } = useWorkItems(
    item
      ? {
          module: "development",
          type: workItemType,
        }
      : undefined,
  );

  if (!item) return null;

  const amount = item.proposal?.requested_amount ?? item.opportunity?.max_amount ?? null;
  const awarded = item.proposal?.awarded_amount ?? null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex flex-col gap-2">
              <span>{item.title}</span>
              <span className="text-sm font-normal text-muted-foreground">{item.funderName || "Unassigned funder"}</span>
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <div className="flex flex-wrap gap-2">
              <Badge>{item.stage}</Badge>
              {item.ngoName && <Badge variant="outline">{item.ngoName}</Badge>}
              {item.ngoBundle && <Badge variant="secondary">{item.ngoBundle}</Badge>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">LOI due</p>
                <p className="font-medium">{formatDate(item.loiDue)}</p>
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">Proposal due</p>
                <p className="font-medium">{formatDate(item.proposalDue || item.deadline)}</p>
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">Requested amount</p>
                <p className="font-medium">{amount ? currencyFormatter.format(amount) : "—"}</p>
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">Awarded amount</p>
                <p className="font-medium">{awarded ? currencyFormatter.format(awarded) : "—"}</p>
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">Submitted</p>
                <p className="font-medium">{formatDate(item.proposal?.submitted_at)}</p>
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">Decision</p>
                <p className="font-medium">{formatDate(item.proposal?.decision_at)}</p>
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">Internal owner</p>
                <p className="font-medium">
                  {item.proposal?.owner?.full_name || item.proposal?.owner?.email || "—"}
                </p>
              </div>
            </div>

            {item.proposal?.notes && (
              <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-sm">
                <p className="text-muted-foreground">Proposal notes</p>
                <p className="mt-2">{item.proposal.notes}</p>
              </div>
            )}

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Linked work items</h3>
                  <p className="text-xs text-muted-foreground">
                    Drafting, approvals, and submission evidence tasks.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setDialogTitle(`Draft: ${item.title}`);
                    setDialogOpen(true);
                  }}
                >
                  Create work item
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Drafting task", title: `Drafting: ${item.title}` },
                  { label: "Internal review", title: `Review: ${item.title}` },
                  { label: "Submission proof", title: `Submission proof: ${item.title}` },
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
                        <p className="mt-1 text-xs text-muted-foreground">
                          Due {formatDate(workItem.due_date)}
                        </p>
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

      <DevelopmentWorkItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultTitle={dialogTitle}
        workItemType={workItemType}
        ngoId={item.proposal?.ngo_id || undefined}
        module="development"
      />
    </>
  );
}
