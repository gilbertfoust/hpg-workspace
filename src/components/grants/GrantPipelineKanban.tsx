import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DnDKanbanBoard, KanbanColumn } from "@/components/common/DnDKanbanBoard";
import { GRANT_STAGES } from "@/modules/grants/types";
import { Building2, DollarSign, Calendar } from "lucide-react";
import { format } from "date-fns";

interface GrantApp {
  id: string;
  title: string;
  stage: string;
  amount_requested: number | null;
  amount_awarded: number | null;
  submitted_at: string | null;
  notes: string | null;
  ngos?: { legal_name: string; common_name: string | null } | null;
  grant_opportunities?: { id: string; title: string; deadline: string | null } | null;
}

const STAGE_COLORS: Record<string, string> = {
  prospect: "text-muted-foreground",
  researching: "text-blue-600 dark:text-blue-400",
  writing: "text-indigo-600 dark:text-indigo-400",
  submitted: "text-yellow-600 dark:text-yellow-400",
  under_review: "text-orange-600 dark:text-orange-400",
  awarded: "text-green-600 dark:text-green-400",
  declined: "text-red-600 dark:text-red-400",
  reporting: "text-purple-600 dark:text-purple-400",
  closed: "text-muted-foreground",
};

interface Props {
  applications: GrantApp[];
  onStageChange: (id: string, stage: string) => void;
  onSelect?: (app: GrantApp) => void;
}

export function GrantPipelineKanban({ applications, onStageChange, onSelect }: Props) {
  const columns = useMemo<KanbanColumn<GrantApp>[]>(() => {
    return GRANT_STAGES.map((stage) => ({
      id: stage,
      label: stage.replace(/_/g, " "),
      items: applications.filter((a) => a.stage === stage),
    }));
  }, [applications]);

  return (
    <DnDKanbanBoard
      columns={columns}
      getItemId={(a) => a.id}
      onDrop={(itemId, targetCol) => onStageChange(itemId, targetCol)}
      columnWidth={240}
      renderCard={(app) => (
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => onSelect?.(app)}
        >
          <CardContent className="p-3 space-y-1.5">
            <p className="text-sm font-medium leading-tight line-clamp-2">{app.title}</p>
            {(app as any).ngos && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Building2 className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">
                  {(app as any).ngos.common_name || (app as any).ngos.legal_name}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {app.amount_requested && (
                <span className="flex items-center gap-0.5">
                  <DollarSign className="h-3 w-3" />
                  {app.amount_requested.toLocaleString()}
                </span>
              )}
              {(app as any).grant_opportunities?.deadline && (
                <span className="flex items-center gap-0.5">
                  <Calendar className="h-3 w-3" />
                  {format(new Date((app as any).grant_opportunities.deadline), "MMM d")}
                </span>
              )}
            </div>
            {app.notes && (
              <p className="text-xs text-muted-foreground line-clamp-1">{app.notes}</p>
            )}
          </CardContent>
        </Card>
      )}
    />
  );
}
