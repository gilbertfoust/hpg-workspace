import type { ReactNode } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

type DashboardPanelStateProps = {
  isLoading?: boolean;
  isError?: boolean;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  errorMessage?: string;
  loadingLabel?: string;
  children: ReactNode;
};

export const DashboardPanelState = ({
  isLoading,
  isError,
  isEmpty,
  emptyTitle = "No data yet",
  emptyDescription = "Data will appear here once records are created in the workspace.",
  errorMessage = "This panel could not load its data. Other dashboard sections will continue to work.",
  loadingLabel = "Loading dashboard data…",
  children,
}: DashboardPanelStateProps) => {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <p className="text-sm">{loadingLabel}</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 py-8 px-4 text-center">
        <AlertCircle className="h-5 w-5 text-destructive" />
        <p className="text-sm text-muted-foreground">{errorMessage}</p>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="rounded-lg border border-dashed py-8 px-4 text-center">
        <p className="text-sm font-medium">{emptyTitle}</p>
        <p className="mt-1 text-sm text-muted-foreground">{emptyDescription}</p>
      </div>
    );
  }

  return <>{children}</>;
};
