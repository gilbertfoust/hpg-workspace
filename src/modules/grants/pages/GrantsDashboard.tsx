import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useGrantApplications } from "@/hooks/useGrantApplications";
import { useGrantOpportunities } from "@/hooks/useGrantOpportunities";
import { GRANT_STAGES } from "@/modules/grants/types";
import { Search, GitBranch, DollarSign, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function GrantsDashboard() {
  const navigate = useNavigate();
  const { data: applications } = useGrantApplications();
  const { data: opportunities } = useGrantOpportunities({ status: "open" });

  const stats = {
    openOpportunities: opportunities?.length ?? 0,
    activeApplications: applications?.filter(a => !["closed", "declined"].includes(a.stage)).length ?? 0,
    totalAwarded: applications?.filter(a => a.stage === "awarded").reduce((s, a) => s + (a.amount_awarded ?? 0), 0) ?? 0,
    deadlineSoon: opportunities?.filter(o => {
      if (!o.deadline) return false;
      const diff = new Date(o.deadline).getTime() - Date.now();
      return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
    }).length ?? 0,
  };

  const stageCounts = GRANT_STAGES.reduce((acc, stage) => {
    acc[stage] = applications?.filter(a => a.stage === stage).length ?? 0;
    return acc;
  }, {} as Record<string, number>);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Grant Management</h1>
          <p className="text-muted-foreground">Search opportunities, track applications, manage awards</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/grants/search")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Open Opportunities</CardTitle>
              <Search className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{stats.openOpportunities}</p></CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/grants/pipeline")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Applications</CardTitle>
              <GitBranch className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{stats.activeApplications}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Awarded</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">${stats.totalAwarded.toLocaleString()}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Deadlines &lt; 30d</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{stats.deadlineSoon}</p></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Pipeline Overview</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {GRANT_STAGES.map(stage => (
                <Badge key={stage} variant={stageCounts[stage] > 0 ? "default" : "outline"} className="text-xs">
                  {stage.replace(/_/g, " ")} ({stageCounts[stage]})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
