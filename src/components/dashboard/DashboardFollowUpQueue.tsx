import { useNavigate } from "react-router-dom";
import { CalendarClock, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardActionCenter } from "@/hooks/useDashboardActionCenter";
import type { DashboardFilters } from "@/hooks/useDashboardData";

export const DashboardFollowUpQueue = ({ filters }: { filters: DashboardFilters }) => {
  const navigate = useNavigate();
  const { data, isLoading } = useDashboardActionCenter(filters);

  const followUps = (data?.items ?? [])
    .filter((item) =>
      item.reasons.some((reason) =>
        ["Overdue", "Due this week", "Waiting on NGO", "Missing evidence", "Unassigned"].includes(reason),
      ),
    )
    .slice(0, 6);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            Follow-Up Queue
          </CardTitle>
          <CardDescription>Compact next human follow-ups across the current dashboard view.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/work-items")}>
          Open queue
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : followUps.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No follow-ups queued for the current view.</p>
        ) : (
          <div className="space-y-2">
            {followUps.map((item) => (
              <button
                key={item.id}
                type="button"
                className="flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left hover:bg-accent/40"
                onClick={() => navigate(`/work-items?highlight=${item.id}`)}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.ngoName} • {item.department}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge variant="outline" className="text-[10px]">
                    {item.reasons[0]}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : "No due date"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
