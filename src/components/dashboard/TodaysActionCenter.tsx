import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, Clock, Flag, Loader2, UserX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardActionCenter, type ActionCenterReason } from "@/hooks/useDashboardActionCenter";
import type { DashboardFilters } from "@/hooks/useDashboardData";

const reasonStyles: Record<ActionCenterReason, { icon: ReactNode; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  Overdue: { icon: <AlertCircle className="h-3.5 w-3.5" />, variant: "destructive" },
  "Due this week": { icon: <Clock className="h-3.5 w-3.5" />, variant: "secondary" },
  "High priority": { icon: <Flag className="h-3.5 w-3.5" />, variant: "default" },
  "Waiting on NGO": { icon: <Clock className="h-3.5 w-3.5" />, variant: "outline" },
  "Missing evidence": { icon: <AlertCircle className="h-3.5 w-3.5" />, variant: "secondary" },
  Unassigned: { icon: <UserX className="h-3.5 w-3.5" />, variant: "outline" },
};

const reasonOrder: ActionCenterReason[] = [
  "Overdue",
  "Due this week",
  "High priority",
  "Waiting on NGO",
  "Missing evidence",
  "Unassigned",
];

const formatDueDate = (date: string | null) => {
  if (!date) return "No due date";
  return new Date(date).toLocaleDateString();
};

export const TodaysActionCenter = ({ filters = {} }: { filters?: DashboardFilters }) => {
  const navigate = useNavigate();
  const { data, isLoading } = useDashboardActionCenter(filters);
  const hasFilters = Boolean(filters.bundle || filters.country || filters.state || filters.module);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-primary" />
            Today&apos;s Action Center
          </CardTitle>
          <CardDescription>
            Priority work that needs attention now.
            {hasFilters ? " Showing items matching the current dashboard filters." : ""}
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/work-items")}>
          Open full queue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
              {reasonOrder.map((reason) => {
                const style = reasonStyles[reason];
                return (
                  <div key={reason} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">{reason}</span>
                      <span className="text-muted-foreground">{style.icon}</span>
                    </div>
                    <p className="mt-1 text-xl font-semibold">{data?.summary?.[reason] ?? 0}</p>
                  </div>
                );
              })}
            </div>

            {!data?.items?.length ? (
              <p className="text-sm text-muted-foreground text-center py-6">No urgent action items right now.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Title</th>
                      <th className="px-3 py-2">NGO</th>
                      <th className="px-3 py-2">Department</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Due</th>
                      <th className="px-3 py-2">Reasons</th>
                      <th className="px-3 py-2 text-right">Open</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item) => (
                      <tr key={item.id} className="border-t hover:bg-accent/40">
                        <td className="px-3 py-2 font-medium max-w-[260px] truncate">{item.title}</td>
                        <td className="px-3 py-2 text-muted-foreground">{item.ngoName}</td>
                        <td className="px-3 py-2 text-muted-foreground">{item.department}</td>
                        <td className="px-3 py-2 capitalize">{item.status}</td>
                        <td className="px-3 py-2 text-muted-foreground">{formatDueDate(item.dueDate)}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {item.reasons.map((reason) => (
                              <Badge key={reason} variant={reasonStyles[reason].variant} className="text-[11px]">
                                {reason}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/work-items?highlight=${item.id}`)}>
                            Open
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
