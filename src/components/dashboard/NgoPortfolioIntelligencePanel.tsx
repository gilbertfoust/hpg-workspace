import { Building2, Loader2, MapPin, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardPortfolioIntelligence } from "@/hooks/useDashboardPortfolioIntelligence";
import type { DashboardFilters } from "@/hooks/useDashboardData";

const DistributionList = ({ title, items }: { title: string; items: { label: string; count: number }[] }) => (
  <div className="rounded-lg border p-3">
    <p className="text-xs font-medium text-muted-foreground">{title}</p>
    {items.length === 0 ? (
      <p className="mt-2 text-sm text-muted-foreground">No data in current view.</p>
    ) : (
      <ul className="mt-2 space-y-1">
        {items.map((item) => (
          <li key={item.label} className="flex justify-between text-sm">
            <span className="truncate pr-2">{item.label}</span>
            <span className="font-medium">{item.count}</span>
          </li>
        ))}
      </ul>
    )}
  </div>
);

export const NgoPortfolioIntelligencePanel = ({ filters }: { filters: DashboardFilters }) => {
  const { data, isLoading } = useDashboardPortfolioIntelligence(filters);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          NGO Portfolio Intelligence
        </CardTitle>
        <CardDescription>Interpretive view of NGO distribution for the current dashboard filters.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" /> Largest portfolio country
                </p>
                <p className="mt-1 text-lg font-semibold">{data?.largestCountry ?? "None"}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Largest status group</p>
                <p className="mt-1 text-lg font-semibold">{data?.largestStatusGroup ?? "None"}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ShieldAlert className="h-3.5 w-3.5" /> Compliance risk count
                </p>
                <p className="mt-1 text-lg font-semibold text-destructive">{data?.complianceRiskCount ?? 0}</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <DistributionList title="By country" items={data?.byCountry ?? []} />
              <DistributionList title="By bundle" items={data?.byBundle ?? []} />
              <DistributionList title="By status" items={data?.byStatus ?? []} />
            </div>
            <p className="text-xs text-muted-foreground">
              {data?.totalNgos ?? 0} NGOs in the current filtered portfolio view.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
