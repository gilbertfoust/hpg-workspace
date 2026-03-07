import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { PartnershipPipelineItem, PartnershipPipelineStage } from "./types";

interface PartnershipsPipelineBoardProps {
  items: PartnershipPipelineItem[];
  stages: PartnershipPipelineStage[];
  onSelect: (item: PartnershipPipelineItem) => void;
}

export function PartnershipsPipelineBoard({ items, stages, onSelect }: PartnershipsPipelineBoardProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-6">
      {stages.map((stage) => {
        const columnItems = items.filter((item) => item.stage === stage);
        return (
          <div key={stage} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{stage}</h3>
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
                    className="cursor-pointer border border-border/80 p-3 shadow-sm transition hover:border-primary/50 hover:bg-muted/30"
                    onClick={() => onSelect(item)}
                  >
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.partnerName}</p>
                      <p className="text-xs text-muted-foreground">{item.partnerType || "Partner"}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {item.region && <Badge variant="outline">{item.region}</Badge>}
                      {item.status && <Badge variant="secondary">{item.status}</Badge>}
                      {item.ngoName && <Badge variant="outline">{item.ngoName}</Badge>}
                      {item.ngoBundle && <Badge variant="secondary">{item.ngoBundle}</Badge>}
                    </div>
                    {item.primaryContact && (
                      <p className="text-xs text-muted-foreground">Primary contact: {item.primaryContact}</p>
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
