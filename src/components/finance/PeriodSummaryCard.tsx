import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface PeriodSummaryCardProps {
  label: string;
  periodType: string;
  startDate: string;
  endDate: string;
  currency?: string | null;
  totalIncome: number;
  totalExpense: number;
  reviewStatus?: string;
}

const statusColors: Record<string, string> = {
  not_started: "bg-muted text-muted-foreground",
  awaiting_ngo: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  under_review: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  needs_revision: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export function PeriodSummaryCard({
  label, periodType, startDate, endDate, currency,
  totalIncome, totalExpense, reviewStatus,
}: PeriodSummaryCardProps) {
  const surplus = totalIncome - totalExpense;
  const curr = currency || "USD";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{label}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="capitalize">{periodType}</Badge>
            {reviewStatus && (
              <Badge className={statusColors[reviewStatus] || "bg-muted"}>
                {reviewStatus.replace(/_/g, " ")}
              </Badge>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {format(new Date(startDate), "MMM d, yyyy")} – {format(new Date(endDate), "MMM d, yyyy")}
          {currency && ` · ${currency}`}
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Income</p>
            <p className="font-semibold text-green-600 dark:text-green-400">
              {new Intl.NumberFormat("en-US", { style: "currency", currency: curr }).format(totalIncome)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Expense</p>
            <p className="font-semibold text-red-600 dark:text-red-400">
              {new Intl.NumberFormat("en-US", { style: "currency", currency: curr }).format(totalExpense)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Surplus / Deficit</p>
            <p className={`font-semibold ${surplus >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              {new Intl.NumberFormat("en-US", { style: "currency", currency: curr }).format(surplus)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
