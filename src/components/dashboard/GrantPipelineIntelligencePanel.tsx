import { Briefcase, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardGrantPipeline } from "@/hooks/useDashboardGrantPipeline";

export const GrantPipelineIntelligencePanel = () => {
  const { data, isLoading } = useDashboardGrantPipeline();

  const anyAvailable = data?.opportunitiesAvailable || data?.applicationsAvailable || data?.grantWorkItemsAvailable;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-primary" />
          Grant Pipeline Intelligence
        </CardTitle>
        <CardDescription>Summary of grant opportunities, applications, and related work items.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !anyAvailable ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Grant pipeline data is not connected yet. Connect grant tables to populate this panel.
          </p>
        ) : (
          <div className="space-y-4">
            {data?.partiallyConnected && (
              <Badge variant="secondary">Data partially connected</Badge>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Opportunities</p>
                <p className="mt-1 text-xl font-semibold">
                  {data?.opportunitiesAvailable ? data.opportunitiesCount : "—"}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Applications</p>
                <p className="mt-1 text-xl font-semibold">
                  {data?.applicationsAvailable ? data.applicationsCount : "—"}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Active / in progress</p>
                <p className="mt-1 text-xl font-semibold">
                  {data?.applicationsAvailable ? data.activeApplicationsCount : "—"}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Grant work items</p>
                <p className="mt-1 text-xl font-semibold">
                  {data?.grantWorkItemsAvailable ? data.grantWorkItemsCount : "—"}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
