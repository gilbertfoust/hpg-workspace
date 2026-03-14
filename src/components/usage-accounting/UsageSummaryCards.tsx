import { useUsageEntries } from "@/hooks/useUsageEntries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Clock, FileText, CheckCircle } from "lucide-react";

export function UsageSummaryCards({ filters }: { filters?: { fiscal_period_id?: string; ngo_id?: string } }) {
  const { data: allEntries = [] } = useUsageEntries(filters);

  const totalCost = allEntries.reduce((s, e) => s + Number(e.total_cost), 0);
  const totalEntries = allEntries.length;
  const pendingCount = allEntries.filter(e => e.status === "pending_review").length;
  const allocatedCount = allEntries.filter(e => e.status === "allocated").length;

  const cards = [
    { title: "Total Usage Cost", value: `$${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: DollarSign, color: "text-primary" },
    { title: "Total Entries", value: totalEntries.toString(), icon: FileText, color: "text-blue-600" },
    { title: "Pending Review", value: pendingCount.toString(), icon: Clock, color: "text-amber-600" },
    { title: "Allocated", value: allocatedCount.toString(), icon: CheckCircle, color: "text-green-600" },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {cards.map(c => (
        <Card key={c.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
            <c.icon className={`h-4 w-4 ${c.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{c.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
