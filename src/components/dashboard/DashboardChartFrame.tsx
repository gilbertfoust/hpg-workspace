import type { ReactNode } from "react";
import { AlertCircle, BarChart3, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type DashboardChartFallbackItem = {
  label: string;
  value: string | number;
};

type DashboardChartFrameProps = {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  chartClassName?: string;
  isLoading?: boolean;
  isError?: boolean;
  isEmpty?: boolean;
  onRetry?: () => void;
  errorTitle?: string;
  errorDescription?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  accessibleSummary?: string;
  fallbackItems?: DashboardChartFallbackItem[];
};

export const DashboardChartFrame = ({
  title,
  description,
  children,
  className,
  chartClassName,
  isLoading = false,
  isError = false,
  isEmpty = false,
  onRetry,
  errorTitle = "Chart data could not be loaded",
  errorDescription = "The rest of the dashboard remains available. Retry this chart after the connection is restored.",
  emptyTitle = "No records in this view",
  emptyDescription = "Data will appear here when matching records are available.",
  accessibleSummary,
  fallbackItems = [],
}: DashboardChartFrameProps) => {
  const stateClassName = cn(
    "flex h-full min-h-0 flex-col items-center justify-center rounded-md border border-dashed px-5 text-center",
    isError ? "border-destructive/40 bg-destructive/5" : "bg-muted/10",
  );

  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <div className={cn("h-[220px] min-w-0 sm:h-[250px]", chartClassName)}>
          {isLoading ? (
            <div className={stateClassName} role="status" aria-live="polite">
              <Loader2 className="mb-3 h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-medium">Loading {title.toLowerCase()}…</p>
            </div>
          ) : isError ? (
            <div className={stateClassName} role="alert">
              <AlertCircle className="mb-3 h-5 w-5 text-destructive" aria-hidden="true" />
              <p className="text-sm font-medium text-destructive">{errorTitle}</p>
              <p className="mt-1 max-w-md text-xs text-muted-foreground">{errorDescription}</p>
              {onRetry ? (
                <Button className="mt-4" size="sm" variant="outline" onClick={onRetry}>
                  <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                  Retry chart
                </Button>
              ) : null}
            </div>
          ) : isEmpty ? (
            <div className={stateClassName}>
              <BarChart3 className="mb-3 h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-medium">{emptyTitle}</p>
              <p className="mt-1 max-w-md text-xs text-muted-foreground">{emptyDescription}</p>
            </div>
          ) : (
            <>
              <div className="h-full min-w-0" role="img" aria-label={accessibleSummary || title}>
                {children}
              </div>
              {fallbackItems.length > 0 ? (
                <dl className="sr-only">
                  {fallbackItems.map((item) => (
                    <div key={item.label}>
                      <dt>{item.label}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
