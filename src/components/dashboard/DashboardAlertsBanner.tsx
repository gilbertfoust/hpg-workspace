import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboardData, type DashboardFilters } from "@/hooks/useDashboardData";
import { useDashboardDataHealth } from "@/hooks/useDashboardDataHealth";
import { toDashboardSearchParams } from "@/lib/dashboardSearchParams";

export const DashboardAlertsBanner = ({ filters }: { filters: DashboardFilters }) => {
  const navigate = useNavigate();
  const { data: dashboardData } = useDashboardData(filters);
  const { data: healthData } = useDashboardDataHealth();

  const overdue = dashboardData?.kpis?.overdue ?? 0;
  const missingEvidence = dashboardData?.evidencePending?.length ?? 0;
  const atRisk = dashboardData?.atRiskNgos?.length ?? 0;
  const missingSources = healthData?.missing ?? 0;

  const hasAlerts = overdue > 0 || missingEvidence > 0 || atRisk > 0 || missingSources > 0;
  if (!hasAlerts) return null;

  const baseParams = {
    bundle: filters.bundle,
    country: filters.country,
    state: filters.state,
    module: filters.module,
  };

  const parts: string[] = [];
  if (overdue > 0) parts.push(`${overdue} overdue item${overdue === 1 ? "" : "s"}`);
  if (missingEvidence > 0) parts.push(`${missingEvidence} missing evidence`);
  if (atRisk > 0) parts.push(`${atRisk} at-risk NGO${atRisk === 1 ? "" : "s"}`);
  if (missingSources > 0) parts.push(`${missingSources} missing data source${missingSources === 1 ? "" : "s"}`);

  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 dashboard-no-print">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-destructive">Urgent attention needed</p>
            <p className="text-sm text-muted-foreground mt-1">{parts.join(" • ")}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {overdue > 0 && (
            <Button size="sm" variant="outline" onClick={() => navigate(`/work-items${toDashboardSearchParams({ ...baseParams, due: "overdue" })}`)}>
              Overdue
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          )}
          {missingEvidence > 0 && (
            <Button size="sm" variant="outline" onClick={() => navigate(`/work-items${toDashboardSearchParams(baseParams)}`)}>
              Evidence
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          )}
          {atRisk > 0 && (
            <Button size="sm" variant="outline" onClick={() => navigate(`/ngos${toDashboardSearchParams({ ...baseParams, portfolioStatus: "out_of_compliance" })}`)}>
              At-risk NGOs
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          )}
          {missingSources > 0 && (
            <Button size="sm" variant="outline" onClick={() => navigate(`/dashboard${toDashboardSearchParams({ ...baseParams, section: "data-health" })}`)}>
              Data health
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
