import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, ClipboardList, FileText, FormInput, GitBranch, Landmark, ScrollText, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardRecentActivity, type RecentActivityType } from "@/hooks/useDashboardRecentActivity";
import type { DashboardFilters } from "@/hooks/useDashboardData";
import { DashboardPanelState } from "@/components/dashboard/DashboardPanelState";

const iconMap: Record<RecentActivityType, ReactNode> = {
  work_item: <ClipboardList className="h-4 w-4" />,
  document: <FileText className="h-4 w-4" />,
  form_submission: <FormInput className="h-4 w-4" />,
  grant_opportunity: <Landmark className="h-4 w-4" />,
  grant_application: <GitBranch className="h-4 w-4" />,
  ngo: <Users className="h-4 w-4" />,
  audit: <ScrollText className="h-4 w-4" />,
};

const labelMap: Record<RecentActivityType, string> = {
  work_item: "Work Item",
  document: "Document",
  form_submission: "Form",
  grant_opportunity: "Grant",
  grant_application: "Application",
  ngo: "NGO",
  audit: "Audit",
};

const formatWhen = (timestamp: string) => {
  const date = new Date(timestamp);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
};

export const RecentActivityFeed = ({ filters = {} }: { filters?: DashboardFilters }) => {
  const navigate = useNavigate();
  const { data: activity, isLoading, isError } = useDashboardRecentActivity(filters);
  const hasFilters = Boolean(filters.bundle || filters.country || filters.state || filters.module);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Recent Activity
          </CardTitle>
          <CardDescription>
            Latest movement across work items, NGOs, grants, documents, forms, and audit records.
            {hasFilters ? " Filtered to work items, documents, and NGOs matching the current dashboard view." : ""}
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/reports")}>
          Open reports
        </Button>
      </CardHeader>
      <CardContent>
        <DashboardPanelState
          isLoading={isLoading}
          isError={isError}
          isEmpty={!isLoading && !isError && !activity?.length}
          emptyTitle="No recent activity"
          emptyDescription="Activity appears when work items, NGOs, documents, grants, or forms are created or updated."
          errorMessage="Recent activity could not load. Other dashboard sections will continue to work."
        >
          <div className="space-y-2">
            {activity?.map((item) => (
              <button
                key={item.id}
                type="button"
                className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent/40"
                onClick={() => navigate(item.path)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <span className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">{iconMap[item.type]}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant="outline" className="text-[11px]">{labelMap[item.type]}</Badge>
                    <span className="text-[11px] text-muted-foreground">{formatWhen(item.createdAt)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </DashboardPanelState>
      </CardContent>
    </Card>
  );
};
