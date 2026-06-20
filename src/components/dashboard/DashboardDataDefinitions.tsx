import { useState } from "react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const definitions = [
  {
    title: "Filtered vs system-wide panels",
    body: "Executive Brief, KPIs, charts, Action Center, Follow-Up Queue, Recent Activity (partial), and portfolio intelligence respect dashboard filters. Module Snapshots, Data Health, Finance/HR readiness, and Grant Pipeline are system-wide.",
  },
  {
    title: "Overdue items",
    body: "Active work items with a due date before today in the current filtered view.",
  },
  {
    title: "Due this week",
    body: "Active work items due within the next 7 days.",
  },
  {
    title: "Missing evidence",
    body: "Work items marked as requiring evidence that are not yet approved.",
  },
  {
    title: "At-risk NGOs",
    body: "NGOs with compliance-related statuses such as at_risk, out_of_compliance, or suspended.",
  },
  {
    title: "Data readiness %",
    body: "Percentage of tracked dashboard sources that are live or empty-but-ready. Missing sources lower readiness.",
  },
  {
    title: "Live / Empty / Missing",
    body: "Live means the table exists and has records. Empty means the table exists but has no records yet. Missing means the dashboard could not access the source.",
  },
];

export const DashboardDataDefinitions = () => {
  const [open, setOpen] = useState(false);

  return (
    <Card className="dashboard-no-print">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            How this dashboard is calculated
          </CardTitle>
          <CardDescription>Plain-language definitions for major metrics and panel behavior.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? "Hide" : "Show"} definitions
          {open ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />}
        </Button>
      </CardHeader>
      {open && (
        <CardContent className="grid gap-3 md:grid-cols-2">
          {definitions.map((item) => (
            <div key={item.title} className="rounded-lg border p-3">
              <p className="text-sm font-medium">{item.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
};
