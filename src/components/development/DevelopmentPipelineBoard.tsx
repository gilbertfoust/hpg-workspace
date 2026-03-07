import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { DevelopmentPipelineItem, DevelopmentPipelineStage } from "./types";

interface DevelopmentPipelineBoardProps {
  items: DevelopmentPipelineItem[];
  stages: DevelopmentPipelineStage[];
  onSelect: (item: DevelopmentPipelineItem) => void;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  return format(new Date(value), "MMM d, yyyy");
};

export function DevelopmentPipelineBoard({ items, stages, onSelect }: DevelopmentPipelineBoardProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-6">
      {stages.map((stage) => {
        const columnItems = items.filter((item) => item.stage === stage);
        return (
          <div key={stage} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {stage}
              </h3>
              <Badge variant="secondary">{columnItems.length}</Badge>
            </div>
            <div className="flex flex-col gap-3">
              {columnItems.length === 0 ? (
                <Card className="border-dashed border-muted-foreground/30 p-4 text-xs text-muted-foreground">
                  No records
                </Card>
              ) : (
                columnItems.map((item) => (
                  <Card
                    key={item.id}
                    className={cn(
                      "cursor-pointer border border-border/80 p-3 shadow-sm transition hover:border-primary/50 hover:bg-muted/30",
                    )}
                    onClick={() => onSelect(item)}
                  >
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.funderName || "Unassigned funder"}</p>
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex items-center justify-between">
                          <span>LOI due</span>
                          <span className="text-foreground">{formatDate(item.loiDue)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Proposal due</span>
                          <span className="text-foreground">{formatDate(item.proposalDue || item.deadline)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Amount</span>
                          <span className="text-foreground">
                            {item.amount ? currencyFormatter.format(item.amount) : "—"}
                          </span>
                        </div>
                      </div>
                      {(item.ngoName || item.ngoBundle) && (
                        <div className="flex flex-wrap gap-2">
                          {item.ngoName && (
                            <Badge variant="outline" className="text-[11px]">
                              {item.ngoName}
                            </Badge>
                          )}
                          {item.ngoBundle && (
                            <Badge variant="secondary" className="text-[11px]">
                              {item.ngoBundle}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
